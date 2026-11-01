export type GitHubAction = 
  | 'create_repo' 
  | 'list_repos' 
  | 'create_branch' 
  | 'create_pr' 
  | 'merge_pr' 
  | 'create_issue' 
  | 'list_issues' 
  | 'unknown';

export interface GitHubIntent {
  action: GitHubAction;
  params: Record<string, string>;
}

export function parseGitHubIntent(message: string): { action: GitHubAction, params: Record<string, string> } {
  const m = message.toLowerCase().trim()
  const params: Record<string, string> = {}

  // Extract repo/branch name — priority: quoted → keyword → last noun word
  const quotedMatch = message.match(/['""']([a-zA-Z0-9_.\-]+)['""']/)
  if (quotedMatch) params.name = quotedMatch[1]

  const keywordMatch = message.match(
    /(?:called|named|naam|name|rakhna|rakho|rakhe|ka naam)\s*[:'""']?\s*([a-zA-Z0-9_.\-]+)/i
  )
  if (keywordMatch && !params.name) params.name = keywordMatch[1]

  // private flag
  if (m.includes('private')) params.private = 'true'
  if (m.includes('public')) params.private = 'false'

  // PR number
  const prNumMatch = message.match(/#(\d+)|\bpr\s*(\d+)/i)
  if (prNumMatch) params.prNumber = prNumMatch[1] || prNumMatch[2]

  // branch from/to
  const fromMatch = message.match(/from\s+([a-zA-Z0-9_.\-\/]+)/i)
  if (fromMatch) params.head = fromMatch[1]
  const toMatch = message.match(/(?:to|into)\s+([a-zA-Z0-9_.\-\/]+)/i)
  if (toMatch) params.base = toMatch[1]

  // action detection — order matters, most specific first
  if ((m.includes('merge') || m.includes('merge kar')) && (m.includes('pr') || m.includes('pull request'))) {
    return { action: 'merge_pr', params }
  }
  if ((m.includes('pull request') || m.includes(' pr ') || m.includes('pr bana') || m.includes('pr create') || m.includes('pr kholo')) && !m.includes('list') && !m.includes('show')) {
    return { action: 'create_pr', params }
  }
  if ((m.includes('issue') || m.includes('bug')) && (m.includes('list') || m.includes('show') || m.includes('dikha') || m.includes('kitne') || m.includes('kya hai'))) {
    return { action: 'list_issues', params }
  }
  if ((m.includes('issue') || m.includes('bug report')) && (m.includes('create') || m.includes('bana') || m.includes('open') || m.includes('kholo') || m.includes('likho') || m.includes('add'))) {
    return { action: 'create_issue', params }
  }
  if (m.includes('branch') && (m.includes('create') || m.includes('bana') || m.includes('new') || m.includes('naya') || m.includes('banao') || m.includes('banado'))) {
    return { action: 'create_branch', params }
  }
  if ((m.includes('repo') || m.includes('repository')) && (m.includes('list') || m.includes('show') || m.includes('kitne') || m.includes('dikha') || m.includes('mere') || m.includes('mera') || m.includes('total') || m.includes('sabke') || m.includes('all'))) {
    return { action: 'list_repos', params }
  }
  if ((m.includes('repo') || m.includes('repository')) && (m.includes('create') || m.includes('bana') || m.includes('new') || m.includes('naya') || m.includes('banao') || m.includes('banado') || m.includes('chahiye') || m.includes('rakhna'))) {
    // extract name from last meaningful word if still not found
    if (!params.name) {
      const words = message.trim().split(/\s+/)
      for (let i = words.length - 1; i >= 0; i--) {
        const w = words[i].replace(/['"?,।।]/g, '')
        if (/^[a-zA-Z0-9_.\-]{2,}$/.test(w) && !['repo','create','private','public','bana','kar','de','naa','please','ek','aur','and','the','a'].includes(w.toLowerCase())) {
          params.name = w
          break
        }
      }
    }
    return { action: 'create_repo', params }
  }

  return { action: 'unknown', params }
}
