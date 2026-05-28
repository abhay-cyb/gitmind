export interface GitHubIntent {
  action: 'create_repo' | 'list_repos' | 'create_branch' | 'create_pr' |
          'merge_pr' | 'create_issue' | 'list_issues' | 'push_files' |
          'unknown';
  params: Record<string, string>;
}

export function parseGitHubIntent(message: string): GitHubIntent {
  const lower = message.toLowerCase();
  const params: Record<string, string> = {};

  // Helper patterns
  const extractNamePattern = /(?:called|named|repo|repository)\s+["']?([a-zA-Z0-9_.-]+)["']?/i;
  const extractBranchNamePattern = /(?:called|named|branch)\s+["']?([a-zA-Z0-9_/.-]+)["']?/i;

  // 1. PUSH FILES
  if ((lower.includes('push') || lower.includes('upload') || lower.includes('commit')) && 
      (lower.includes('file') || lower.includes('change') || lower.includes('code'))) {
    // Extract branch
    const branchMatch = lower.match(/(?:to|into)\s+(?:branch\s+)?([a-zA-Z0-9_.-]+)/);
    if (branchMatch) {
      params.branch = branchMatch[1];
    }
    // Extract commit message if any
    const msgMatch = lower.match(/(?:message|msg|with)\s+["']?([^"']+)["']?/);
    if (msgMatch) {
      params.message = msgMatch[1];
    }
    return { action: 'push_files', params };
  }

  // 2. CREATE REPO
  if ((lower.includes('create') || lower.includes('make') || lower.includes('new') || lower.includes('start')) && 
      (lower.includes('repo') || lower.includes('repository'))) {
    const nameMatch = message.match(extractNamePattern);
    if (nameMatch) {
      params.name = nameMatch[1];
    }
    params.private = lower.includes('private') ? 'true' : 'false';
    
    // Extract optional description
    const descMatch = message.match(/(?:description|desc|about)\s+["']?([^"']+)["']?/i);
    if (descMatch) {
      params.description = descMatch[1];
    }

    return { action: 'create_repo', params };
  }

  // 3. LIST REPOS
  if ((lower.includes('list') || lower.includes('show') || lower.includes('my') || lower.includes('get')) && 
      (lower.includes('repo') || lower.includes('repos') || lower.includes('repositories'))) {
    return { action: 'list_repos', params };
  }

  // 4. MERGE PR
  if (lower.includes('merge') && (lower.includes('pr') || lower.includes('pull request') || lower.includes('pullrequest'))) {
    const numMatch = lower.match(/(?:pr|pull request|#)\s*#?(\d+)/);
    if (numMatch) {
      params.prNumber = numMatch[1];
    }
    return { action: 'merge_pr', params };
  }

  // 5. CREATE PR
  if ((lower.includes('create') || lower.includes('make') || lower.includes('new') || lower.includes('open')) && 
      (lower.includes('pr') || lower.includes('pull request') || lower.includes('pullrequest'))) {
    // Extract head and base: "from head to base"
    const fromToMatch = lower.match(/from\s+([a-zA-Z0-9_/.-]+)\s+to\s+([a-zA-Z0-9_/.-]+)/);
    if (fromToMatch) {
      params.head = fromToMatch[1];
      params.base = fromToMatch[2];
    } else {
      const intoFromMatch = lower.match(/into\s+([a-zA-Z0-9_/.-]+)\s+from\s+([a-zA-Z0-9_/.-]+)/);
      if (intoFromMatch) {
        params.base = intoFromMatch[1];
        params.head = intoFromMatch[2];
      }
    }

    // Extract title
    const titleMatch = message.match(/(?:title|titled|with)\s+["']?([^"']+)["']?/i);
    if (titleMatch) {
      params.title = titleMatch[1];
    }

    return { action: 'create_pr', params };
  }

  // 6. CREATE ISSUE
  if ((lower.includes('create') || lower.includes('new') || lower.includes('make') || lower.includes('open')) && 
      lower.includes('issue')) {
    // E.g. "create issue: login button broken"
    const colonIndex = message.indexOf(':');
    if (colonIndex !== -1) {
      params.title = message.substring(colonIndex + 1).trim();
    } else {
      const titleMatch = message.match(/(?:title|titled|named|called)\s+["']?([^"']+)["']?/i);
      if (titleMatch) {
        params.title = titleMatch[1];
      } else {
        // Fallback: search for words after "issue"
        const issueIndex = lower.indexOf('issue');
        const afterIssue = message.substring(issueIndex + 5).trim();
        if (afterIssue) {
          params.title = afterIssue;
        }
      }
    }
    
    // Extract body if any
    const bodyMatch = message.match(/(?:body|desc|details)\s+["']?([^"']+)["']?/i);
    if (bodyMatch) {
      params.body = bodyMatch[1];
    }

    return { action: 'create_issue', params };
  }

  // 7. LIST ISSUES
  if ((lower.includes('list') || lower.includes('show') || lower.includes('get')) && 
      (lower.includes('issue') || lower.includes('issues'))) {
    return { action: 'list_issues', params };
  }

  // 8. CREATE BRANCH
  if ((lower.includes('create') || lower.includes('make') || lower.includes('new')) && 
      lower.includes('branch')) {
    const branchMatch = message.match(extractBranchNamePattern);
    if (branchMatch) {
      params.name = branchMatch[1];
    }
    
    // E.g., "from main" or "from branch master"
    const fromMatch = lower.match(/from\s+(?:branch\s+)?([a-zA-Z0-9_.-]+)/);
    if (fromMatch) {
      params.from = fromMatch[1];
    }

    return { action: 'create_branch', params };
  }

  return { action: 'unknown', params };
}
