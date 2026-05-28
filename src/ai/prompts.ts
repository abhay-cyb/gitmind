export function getSystemPrompt(projectContext: string, isBreakingCommitAnalysis: boolean = false): string {
  let basePrompt = `You are GitMind, a Git debugging assistant. You analyze git history and explain issues clearly to developers. Be concise and specific. Always mention specific file names and function names when relevant. 

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
