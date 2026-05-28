import * as vscode from 'vscode';
import { getGitClient, getCurrentBranch } from '../git/status';
import { getBranchDiffCommits, getRecentCommits } from '../git/log';
import { AIProvider } from '../ai/provider';
import { getMergeConflictPrompt } from '../ai/prompts';
import { GitMindSidebarProvider } from '../ui/sidebar';
import { ProjectMemory } from '../storage/projectMemory';

export async function explainConflictCommand(
  context: vscode.ExtensionContext,
  sidebarProvider: GitMindSidebarProvider
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    sidebarProvider.showError('No active editor open. Open a conflicted file to explain conflict.');
    return;
  }

  const document = editor.document;
  const text = document.getText();
  
  if (!text.includes('<<<<<<<')) {
    sidebarProvider.showError('No merge conflict markers (<<<<<<<) found in the active file.');
    return;
  }

  sidebarProvider.setLoader(true, 'Analyzing merge conflict markers...');

  try {
    // Extract HEAD (YOURS) and INCOMING versions
    const conflictData = parseConflictContent(text);
    if (!conflictData) {
      sidebarProvider.setLoader(false);
      sidebarProvider.showError('Failed to parse merge conflict markers.');
      return;
    }

    const filename = vscode.workspace.asRelativePath(document.uri);
    const gitClient = getGitClient();

    let yourCommits = 'No commit context.';
    let incomingCommits = 'No commit context.';

    if (gitClient) {
      try {
        const currentBranch = (await getCurrentBranch()) || 'HEAD';
        
        // Find if MERGE_HEAD exists
        let hasMergeHead = false;
        try {
          await gitClient.revparse(['MERGE_HEAD']);
          hasMergeHead = true;
        } catch (e) {}

        if (hasMergeHead) {
          yourCommits = await getBranchDiffCommits(currentBranch, 'MERGE_HEAD', 5);
          incomingCommits = await getBranchDiffCommits('MERGE_HEAD', currentBranch, 5);
        } else {
          // Fallback to recent commits
          const recent = await getRecentCommits(5);
          yourCommits = recent.map(c => `${c.hash.substring(0,7)} ${c.message}`).join('\n');
          incomingCommits = 'No incoming branch found (not in active merge).';
        }
      } catch (e) {}
    }

    sidebarProvider.setLoader(true, 'Consulting AI models...');

    const projectContext = ProjectMemory.readContext() || 'No project context available.';
    const userPrompt = getMergeConflictPrompt(
      filename,
      conflictData.headText,
      conflictData.incomingText,
      yourCommits,
      incomingCommits,
      projectContext
    );

    const response = await AIProvider.callAI(context, userPrompt);
    sidebarProvider.setLoader(false);

    // Format response
    const formattedHtml = `
      <div class="conflict-container">
        <div class="conflict-file">📌 Conflict in: ${filename}</div>
        <div style="white-space: pre-wrap;" class="ai-output">${response}</div>
      </div>
    `;
    
    sidebarProvider.showResult(formattedHtml, 'Merge Conflict Explanation');
  } catch (e: any) {
    sidebarProvider.setLoader(false);
    sidebarProvider.showError(e.message || 'An error occurred during conflict explanation.');
  }
}

interface ConflictContent {
  headText: string;
  incomingText: string;
}

function parseConflictContent(text: string): ConflictContent | undefined {
  const headStart = text.indexOf('<<<<<<<');
  const separator = text.indexOf('=======');
  const incomingEnd = text.indexOf('>>>>>>>');

  if (headStart === -1 || separator === -1 || incomingEnd === -1) {
    return undefined;
  }

  // Find the exact boundaries of the conflict block
  // We can just grab the first conflict for context scanning
  const headLines = text.substring(headStart, separator).split('\n');
  headLines.shift(); // remove <<<<<<< line
  const headText = headLines.join('\n').trim();

  const incomingLines = text.substring(separator, incomingEnd).split('\n');
  incomingLines.shift(); // remove ======= line
  const incomingText = incomingLines.join('\n').trim();

  return { headText, incomingText };
}

// Background auto-trigger listener
export function registerConflictAutoTrigger(
  context: vscode.ExtensionContext
): void {
  const checkEditor = (editor: vscode.TextEditor | undefined) => {
    if (editor && editor.document.getText().includes('<<<<<<<')) {
      vscode.window.showInformationMessage(
        `GitMind: Merge conflict detected in ${vscode.workspace.asRelativePath(editor.document.uri)}. Explain conflict?`,
        'Explain',
        'Dismiss'
      ).then(selection => {
        if (selection === 'Explain') {
          vscode.commands.executeCommand('gitmind.explainConflict');
        }
      });
    }
  };

  // Check on change
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => checkEditor(editor))
  );

  // Check on open
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor && activeEditor.document === doc) {
        checkEditor(activeEditor);
      }
    })
  );
}
