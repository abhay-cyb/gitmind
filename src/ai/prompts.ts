export function getSystemPrompt(projectContext: string, isBreakingCommitAnalysis: boolean = false): string {
  let basePrompt = `You are GitMind, a Git debugging assistant. You analyze git history and explain issues clearly to developers. Be concise and specific. Always mention specific file names and function names when relevant. 

If the developer asks you to perform a write action on GitHub (such as creating a repository, creating a branch, creating a PR, merging a PR, or creating an issue), you must explain that you are performing the action, and then append the following command syntax on a new line at the very end of your response:
- [GITHUB_ACTION: {"action": "create_repo", "params": {"name": "repo-name", "private": true/false}}]
- [GITHUB_ACTION: {"action": "create_branch", "params": {"name": "new-branch-name", "from": "base-branch-name"}}]
- [GITHUB_ACTION: {"action": "create_pr", "params": {"from": "head-branch", "to": "base-branch", "title": "PR Title"}}]
- [GITHUB_ACTION: {"action": "merge_pr", "params": {"prNumber": "12"}}]
- [GITHUB_ACTION: {"action": "create_issue", "params": {"title": "Issue Title", "body": "Issue description"}}]

Do not output the GITHUB_ACTION block if the user is only asking a question about your capabilities (e.g., "tu repo create kar sakti hai?" or "can you create a repo?"). Only output it when they explicitly command you to perform the action.

Project context:
${projectContext}`;

  if (isBreakingCommitAnalysis) {
    basePrompt += `\n\nRespond in this exact format for breaking commit analysis:
RISK: HIGH/MEDIUM/LOW
COMMIT: <hash>
FILE: <filename>
WHAT: <one sentence what changed>
WHY_RISKY: <one sentence why this is the problem>`;
  }

  return basePrompt;
}

export function getBreakingCommitPrompt(commitList: string, diffs: string): string {
  return `Here are the last 30 commits from this repository:
${commitList}

Here are the diffs for the most suspicious commits:
${diffs}

The developer says something broke recently. Analyze these commits and identify which commit most likely introduced the bug. List top 3 suspicious commits with risk level HIGH/MEDIUM/LOW, which file changed, what specifically changed, and why it's likely the cause. Be specific about function names and logic changes.`;
}

export function getMergeConflictPrompt(
  filename: string,
  headContent: string,
  incomingContent: string,
  yourCommits: string,
  incomingCommits: string,
  projectContext: string
): string {
  return `There is a merge conflict in ${filename}.

YOUR VERSION (HEAD):
${headContent}

INCOMING VERSION:
${incomingContent}

Recent commits on your branch: ${yourCommits}
Recent commits on incoming branch: ${incomingCommits}

Project context: ${projectContext}

Explain: 1) What your branch was trying to do, 2) What the incoming branch was trying to do, 3) Whether these are safe to merge or conflict logically, 4) Specific recommendation for which lines to keep.`;
}

export function getChangeSummarizerPrompt(userQuery: string, commitData: string): string {
  return `Here are git commits matching the query '${userQuery}':
${commitData}

Summarize what changed in plain English. Focus on what features were added, what was fixed, and what might have broken. Keep it under 150 words.`;
}
