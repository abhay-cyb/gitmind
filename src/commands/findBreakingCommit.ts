import * as vscode from 'vscode';
import { getCommitsOneline } from '../git/log';
import { getCommitStat, getCommitFileDiff } from '../git/diff';
import { AIProvider } from '../ai/provider';
import { getBreakingCommitPrompt } from '../ai/prompts';
import { GitMindSidebarProvider } from '../ui/sidebar';

interface CommitScore {
  hash: string;
  message: string;
  stat: string;
  score: number;
  filesToDiff: string[];
}

export async function findBreakingCommitCommand(
  context: vscode.ExtensionContext,
  sidebarProvider: GitMindSidebarProvider
): Promise<void> {
  sidebarProvider.setLoader(true, 'Analyzing last 30 commits...');
  
  try {
    const commitList = await getCommitsOneline(30);
    if (!commitList || commitList.startsWith('Error') || commitList === '') {
      sidebarProvider.setLoader(false);
      sidebarProvider.showError('No commits found or not a Git repository.');
      return;
    }

    // Split commits
    const lines = commitList.split('\n');
    const commitScores: CommitScore[] = [];

    // Analyze stats for each commit
    for (const line of lines) {
      const parts = line.trim().split(' ');
      if (parts.length < 2) { continue; }
      const hash = parts[0];
      const message = parts.slice(1).join(' ');

      const stat = await getCommitStat(hash);
      const score = calculateSuspicionScore(message, stat);
      const filesToDiff = extractSuspiciousFiles(stat);

      commitScores.push({ hash, message, stat, score, filesToDiff });
    }

    // Sort by suspicion score descending
    commitScores.sort((a, b) => b.score - a.score);

    // Pick top 10 commits to extract diff content
    const top10 = commitScores.slice(0, 10);
    let diffsAccumulator = '';

    sidebarProvider.setLoader(true, 'Extracting suspicious diffs...');

    for (const item of top10) {
      if (item.filesToDiff.length > 0) {
        // Get diff of the most suspicious file
        const diffFile = item.filesToDiff[0];
        const diffContent = await getCommitFileDiff(item.hash, diffFile);
        diffsAccumulator += `\n--- COMMIT ${item.hash} (${diffFile}) ---\n${diffContent.substring(0, 1000)}\n`;
      }
    }

    sidebarProvider.setLoader(true, 'Consulting AI models...');

    const userPrompt = getBreakingCommitPrompt(commitList, diffsAccumulator || 'No suspicious diffs extracted.');
    const response = await AIProvider.callAI(context, userPrompt, { isBreakingCommitAnalysis: true });

    const htmlOutput = parseBreakingCommitsToHtml(response);
    sidebarProvider.setLoader(false);
    sidebarProvider.showResult(htmlOutput, 'Breaking Commit Analysis');
  } catch (e: any) {
    sidebarProvider.setLoader(false);
    sidebarProvider.showError(e.message || 'An error occurred during analysis.');
  }
}

function calculateSuspicionScore(message: string, stat: string): number {
  let score = 0;
  const lowerMsg = message.toLowerCase();
  const lowerStat = stat.toLowerCase();

  // Suspicious keywords in commit messages
  const messageKeywords = ['fix', 'bug', 'break', 'error', 'auth', 'login', 'token', 'pay', 'stripe', 'config', 'db', 'database'];
  messageKeywords.forEach(kw => {
    if (lowerMsg.includes(kw)) { score += 5; }
  });

  // Suspicious file matches in status/stat
  const fileKeywords = ['auth', 'login', 'config', 'pay', 'stripe', 'token', 'session', 'db', 'database', 'api', 'webhook'];
  fileKeywords.forEach(kw => {
    if (lowerStat.includes(kw)) { score += 10; }
  });

  // Line insertions/deletions checking
  // E.g., "1 file changed, 10 insertions(+), 5 deletions(-)"
  const insertionsMatch = stat.match(/(\d+)\s+insertion/i);
  const deletionsMatch = stat.match(/(\d+)\s+deletion/i);
  const insertions = insertionsMatch ? parseInt(insertionsMatch[1], 10) : 0;
  const deletions = deletionsMatch ? parseInt(deletionsMatch[1], 10) : 0;
  const totalChanges = insertions + deletions;

  if (totalChanges > 100) { score += 15; }
  else if (totalChanges > 20) { score += 8; }
  else if (totalChanges > 0) { score += 2; }

  return score;
}

function extractSuspiciousFiles(stat: string): string[] {
  const suspicious: string[] = [];
  const lines = stat.split('\n');
  const fileKeywords = ['auth', 'login', 'config', 'pay', 'stripe', 'token', 'session', 'db', 'database', 'api', 'webhook'];

  lines.forEach(line => {
    // Example stat line: " src/auth/tokenValidator.ts | 15 +++--"
    const parts = line.split('|');
    if (parts.length === 2) {
      const filePath = parts[0].trim();
      if (filePath && !filePath.includes(' ') && !filePath.startsWith('Change') && !filePath.startsWith('Create')) {
        const isMatch = fileKeywords.some(kw => filePath.toLowerCase().includes(kw));
        if (isMatch) {
          suspicious.push(filePath);
        }
      }
    }
  });

  // Return any file if no suspicious matched
  if (suspicious.length === 0) {
    lines.forEach(line => {
      const parts = line.split('|');
      if (parts.length === 2) {
        const filePath = parts[0].trim();
        if (filePath && !filePath.includes(' ') && !filePath.startsWith('Change') && !filePath.startsWith('Create')) {
          suspicious.push(filePath);
        }
      }
    });
  }

  return suspicious;
}

export function parseBreakingCommitsToHtml(aiOutput: string): string {
  // Split blocks using RISK: or Risk:
  const blocks = aiOutput.split(/(?:RISK|Risk):/g);
  let html = '';

  for (const block of blocks) {
    if (!block.trim()) { continue; }

    const riskMatch = block.match(/^\s*(HIGH|MEDIUM|LOW)/i);
    const commitMatch = block.match(/(?:COMMIT|Commit):\s*([a-f0-9]+)/i);
    const fileMatch = block.match(/(?:FILE|File):\s*([^\n\r]+)/i);
    const whatMatch = block.match(/(?:WHAT|What):\s*([^\n\r]+)/i);
    const whyMatch = block.match(/(?:WHY_RISKY|Why_Risky|WHY RISKY|Why Risky):\s*([^\n\r]+)/i);

    if (riskMatch || commitMatch || fileMatch) {
      const risk = (riskMatch ? riskMatch[1].toUpperCase() : 'MEDIUM') as 'HIGH' | 'MEDIUM' | 'LOW';
      const commit = commitMatch ? commitMatch[1].trim() : 'unknown';
      const file = fileMatch ? fileMatch[1].trim() : 'unknown';
      const what = whatMatch ? whatMatch[1].trim() : 'No explanation provided.';
      const why = whyMatch ? whyMatch[1].trim() : '';

      const riskClass = risk.toLowerCase();
      const indicator = risk === 'HIGH' ? '🔴' : (risk === 'MEDIUM' ? '🟡' : '🟢');

      html += `
        <div class="commit-card ${riskClass}">
          <div class="commit-header">
            <span>${indicator} ${risk} RISK</span>
            <span class="commit-hash" onclick="viewCommit('${commit}')">${commit.substring(0, 7)}</span>
          </div>
          <div class="commit-body">
            <strong>File:</strong> ${file}<br/>
            <strong>What:</strong> ${what}<br/>
            ${why ? `<strong>Why:</strong> ${why}` : ''}
          </div>
          <div class="commit-footer">
            <button class="btn btn-secondary" style="margin-top: 8px; width: auto; padding: 4px 10px;" onclick="viewCommit('${commit}')">View Commit</button>
          </div>
        </div>
      `;
    }
  }

  if (!html) {
    return `<div style="white-space: pre-wrap;">${aiOutput}</div>`;
  }
  return html;
}
