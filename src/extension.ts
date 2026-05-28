import * as vscode from 'vscode';
import { GitMindSidebarProvider } from './ui/sidebar';
import { WelcomePanel } from './ui/welcomePanel';
import { AIProvider } from './ai/provider';
import { RepoScanner } from './scanner/repoScanner';
import { findBreakingCommitCommand } from './commands/findBreakingCommit';
import { explainConflictCommand, registerConflictAutoTrigger } from './commands/mergeConflict';
import { explainChangesCommand, ChatMessage } from './commands/explainChanges';
import { isGitRepository } from './git/status';
import { showInfo, showError } from './ui/notifications';

export async function activate(context: vscode.ExtensionContext) {
  let chatHistory: ChatMessage[] = [];

  // Sidebar webview resolution and callback actions
  const sidebarProvider = new GitMindSidebarProvider(context.extensionUri, async (action) => {
    // Graceful degradation check: Verify git repo
    const hasGit = await isGitRepository();
    if (!hasGit && action.command !== 'changeModel') {
      sidebarProvider.updateStatus('No git repo ⚠', true);
      sidebarProvider.showError('Open a Git repository to use GitMind.');
      return;
    }

    switch (action.command) {
      case 'changeModel':
        if (action.model) {
          await AIProvider.setSelectedModel(action.model);
          showInfo(`Model changed to ${action.model}`);
        }
        break;

      case 'findBreakingCommit':
        await findBreakingCommitCommand(context, sidebarProvider);
        break;

      case 'refreshContext':
        sidebarProvider.updateStatus('Scanning... ⏳');
        sidebarProvider.setLoader(true, 'Scanning repository context...');
        const res = await RepoScanner.scan(true);
        sidebarProvider.setLoader(false);
        if (res.success) {
          sidebarProvider.updateStatus('Context ready ✓');
          showInfo('Repository context refreshed successfully!');
        } else {
          sidebarProvider.updateStatus('Scan error ⚠', true);
          sidebarProvider.showError(res.message);
        }
        break;

      case 'chatQuery':
        if (action.query) {
          await explainChangesCommand(context, action.query, sidebarProvider, chatHistory);
        }
        break;

      case 'viewCommit':
        if (action.hash) {
          const terminal = vscode.window.terminals.find(t => t.name === 'GitMind Terminal')
            || vscode.window.createTerminal('GitMind Terminal');
          terminal.show();
          terminal.sendText(`git show ${action.hash}`);
        }
        break;
    }
  });

  // Register Webview View
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      GitMindSidebarProvider.viewType,
      sidebarProvider
    )
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('gitmind.findBreakingCommit', async () => {
      const hasGit = await isGitRepository();
      if (!hasGit) {
        showError('No Git repository detected.');
        return;
      }
      await findBreakingCommitCommand(context, sidebarProvider);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gitmind.explainConflict', async () => {
      const hasGit = await isGitRepository();
      if (!hasGit) {
        showError('No Git repository detected.');
        return;
      }
      await explainConflictCommand(context, sidebarProvider);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gitmind.explainChanges', async () => {
      const hasGit = await isGitRepository();
      if (!hasGit) {
        showError('No Git repository detected.');
        return;
      }
      const query = await vscode.window.showInputBox({
        prompt: 'Ask GitMind about git changes (e.g. "What changed yesterday?")',
        placeHolder: 'What did the last 5 commits do?'
      });
      if (query) {
        await explainChangesCommand(context, query, sidebarProvider, chatHistory);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gitmind.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        prompt: 'Enter your OpenRouter API Key',
        password: true,
        placeHolder: 'sk-or-v1-...'
      });
      if (key) {
        await AIProvider.setApiKey(context, key);
        showInfo('OpenRouter API Key saved successfully!');
        
        // Trigger silent background scan once key is added
        await startBackgroundScan(sidebarProvider);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gitmind.refreshContext', async () => {
      const hasGit = await isGitRepository();
      if (!hasGit) {
        showError('No Git repository detected.');
        return;
      }
      sidebarProvider.updateStatus('Scanning... ⏳');
      const scanRes = await RepoScanner.scan(true);
      if (scanRes.success) {
        sidebarProvider.updateStatus('Context ready ✓');
        showInfo('Repository context refreshed.');
      } else {
        sidebarProvider.updateStatus('Scan error ⚠', true);
        showError(scanRes.message);
      }
    })
  );

  // Background conflict auto-trigger
  registerConflictAutoTrigger(context);

  // Check API key and startup scanning workflow
  const apiKey = await AIProvider.getApiKey(context);
  if (!apiKey) {
    sidebarProvider.updateStatus('API Key missing ⚠', true);
    
    // Automatically trigger the Welcome webview panel on first activation
    WelcomePanel.createOrShow(async (key) => {
      await AIProvider.setApiKey(context, key);
      showInfo('OpenRouter API Key saved successfully.');
      await startBackgroundScan(sidebarProvider);
    });
  } else {
    // Key exists, run silent repository scan
    await startBackgroundScan(sidebarProvider);
  }
}

async function startBackgroundScan(sidebarProvider: GitMindSidebarProvider): Promise<void> {
  const hasGit = await isGitRepository();
  if (!hasGit) {
    sidebarProvider.updateStatus('No git repo ⚠', true);
    return;
  }

  sidebarProvider.updateStatus('Scanning... ⏳');
  
  // Scans silently in the background
  RepoScanner.scan(false).then((res) => {
    if (res.success) {
      sidebarProvider.updateStatus('Context ready ✓');
      // Pass the current model to the webview dropdown
      const model = AIProvider.getSelectedModel();
      sidebarProvider.updateModel(model);
    } else {
      sidebarProvider.updateStatus('Scan error ⚠', true);
      sidebarProvider.showError(res.message);
    }
  }).catch((err) => {
    sidebarProvider.updateStatus('Scan error ⚠', true);
    sidebarProvider.showError(err.message || 'Background scan failed.');
  });
}

export function deactivate() {}
