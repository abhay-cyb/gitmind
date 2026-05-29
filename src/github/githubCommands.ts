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

  // 1. Parsing Rules
  let action: GitHubAction = 'unknown';

  if (
    (lower.includes('create') || lower.includes('new') || lower.includes('make')) &&
    (lower.includes('repo') || lower.includes('repository'))
  ) {
    action = 'create_repo';
  } else if (
    (lower.includes('list') || lower.includes('show') || lower.includes('my')) &&
    (lower.includes('repo') || lower.includes('repositories'))
  ) {
    action = 'list_repos';
  } else if (
    lower.includes('branch') &&
    (lower.includes('create') || lower.includes('new') || lower.includes('make'))
  ) {
    action = 'create_branch';
  } else if (
    (lower.includes('pull request') || lower.includes(' pr ')) &&
    !lower.includes('merge')
  ) {
    action = 'create_pr';
  } else if (
    lower.includes('merge') &&
    (lower.includes('pr') || lower.includes('pull request'))
  ) {
    action = 'merge_pr';
  } else if (
    lower.includes('issue') &&
    (lower.includes('create') || lower.includes('new') || lower.includes('open'))
  ) {
    action = 'create_issue';
  } else if (
    lower.includes('issue') &&
    (lower.includes('list') || lower.includes('show') || lower.includes('open'))
  ) {
    action = 'list_issues';
  }

  // 2. Parameter Extraction
  // repo name: extract word after "called", "named", "name" keywords
  const nameMatch = message.match(/(?:called|named|name)\s+["']?([a-zA-Z0-9_.-]+)["']?/i);
  if (nameMatch) {
    params.name = nameMatch[1];
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
