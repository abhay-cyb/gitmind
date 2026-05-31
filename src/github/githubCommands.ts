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

export function parseGitHubIntent(message: string): GitHubIntent {
  const lower = message.toLowerCase();
  const params: Record<string, string> = {};

  const hasWord = (word: string) => new RegExp(`\\b${word}\\b`, 'i').test(lower);

  // 1. Parsing Rules
  let action: GitHubAction = 'unknown';

  if (
    (hasWord('create') || hasWord('new') || hasWord('make') || lower.includes('naam se')) &&
    (hasWord('repo') || hasWord('repository'))
  ) {
    action = 'create_repo';
  } else if (
    (hasWord('list') || hasWord('show') || hasWord('my') || hasWord('newest') || hasWord('recent')) &&
    (hasWord('repo') || hasWord('repos') || hasWord('repository') || hasWord('repositories'))
  ) {
    action = 'list_repos';
  } else if (
    hasWord('branch') &&
    (hasWord('create') || hasWord('new') || hasWord('make'))
  ) {
    action = 'create_branch';
  } else if (
    (lower.includes('pull request') || hasWord('pr')) &&
    !lower.includes('merge')
  ) {
    action = 'create_pr';
  } else if (
    lower.includes('merge') &&
    (hasWord('pr') || lower.includes('pull request'))
  ) {
    action = 'merge_pr';
  } else if (
    lower.includes('issue') &&
    (hasWord('create') || hasWord('new') || hasWord('open'))
  ) {
    action = 'create_issue';
  } else if (
    lower.includes('issue') &&
    (hasWord('list') || hasWord('show') || hasWord('open'))
  ) {
    action = 'list_issues';
  }

  // 2. Parameter Extraction
  // Step 1 — quoted string (single or double quotes):
  const quotedMatch = message.match(/['"]([a-zA-Z0-9_.\-]+)['"]/);
  if (quotedMatch) {
    params.name = quotedMatch[1];
  }

  // Step 2 — after keywords "called", "named", "name", "naam se", "naam":
  const keywordMatch = message.match(/(?:called|named|name|naam\s*se|naam)\s+['"]?([a-zA-Z0-9_.\-]+)['"]?/i);
  if (keywordMatch && !params.name) {
    params.name = keywordMatch[1];
  }

  // Step 3 — last word in message if action is create_repo or create_branch and no name found yet:
  if ((action === 'create_repo' || action === 'create_branch') && !params.name) {
    const words = message.trim().split(/\s+/);
    if (words.length > 0) {
      const lastWord = words[words.length - 1].replace(/['"?,।]/g, '');
      if (/^[a-zA-Z0-9_.\-]+$/.test(lastWord) && lastWord.length > 2) {
        params.name = lastWord;
      }
    }
  }

  // branch names: extract words after "from" and "to" keywords
  const fromMatch = message.match(/from\s+["']?([a-zA-Z0-9_/.-]+)["']?/i);
  if (fromMatch) {
    params.from = fromMatch[1];
  }
  const toMatch = message.match(/to\s+["']?([a-zA-Z0-9_/.-]+)["']?/i);
  if (toMatch) {
    params.to = toMatch[1];
  }

  // PR number: extract digits after "pr #", "pr number", or "#"
  const prMatch = message.match(/(?:pr\s*#|pr\s*number\s*|#\s*)(\d+)/i);
  if (prMatch) {
    params.prNumber = prMatch[1];
  }

  // issue title: extract everything after "issue:" or "issue titled"
  const issueMatch = message.match(/(?:issue:|issue\s+titled\s+)(.+)/i);
  if (issueMatch) {
    params.title = issueMatch[1].trim();
  }

  // private flag: message includes "private" -> params.private = "true"
  if (lower.includes('private')) {
    params.private = 'true';
  }

  return { action, params };
}
