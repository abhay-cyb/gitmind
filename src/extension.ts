import * as vscode from 'vscode';
import { GitMindSidebarProvider } from './ui/sidebar';
import { WelcomePanel } from './ui/welcomePanel';
import { AIProvider } from './ai/provider';
import { GeminiClient } from './ai/gemini';
import { RepoScanner } from './scanner/repoScanner';
import { findBreakingCommitCommand } from './commands/findBreakingCommit';
import { explainConflictCommand, registerConflictAutoTrigger } from './commands/mergeConflict';
import { explainChangesCommand, ChatMessage } from './commands/explainChanges';
import { isGitRepository, getGitClient } from './git/status';
import { showInfo, showError } from './ui/notifications';
import { GitHubClient } from './github/githubClient';
import { parseGitHubIntent } from './github/githubCommands';

export async function activate(context: vscode.ExtensionContext) {
  let chatHistory: Array<{ role: 'user' | 'assistant'; content: string; isHtml?: boolean }> = [];

  // Sidebar webview resolution and callback actions
  const sidebarProvider = new GitMindSidebarProvider(context.extensionUri, async (action) => {
    // Graceful degradation check: Verify git repo for repository-specific commands
    const repoCommands = ['findBreakingCommit', 'explainConflict', 'refreshContext'];
    if (repoCommands.includes(action.command)) {
      const hasGit = await isGitRepository();
      if (!hasGit) {
        sidebarProvider.updateStatus('No git repo ⚠', true);
        sidebarProvider.showError('Open a Git repository to use GitMind.');
        return;
      }
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

      case 'explainConflict':
        await explainConflictCommand(context, sidebarProvider);
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
          const intent = parseGitHubIntent(action.query);
          if (intent.action !== 'unknown') {
            await handleGitHubAction(context, sidebarProvider, action.query);
          } else {
            await handleChatQuery(context, action.query, sidebarProvider, chatHistory);
          }
        }
        break;

      case 'githubAction':
        const msgText = (action as any).text || action.query || '';
        await handleGitHubAction(context, sidebarProvider, msgText);
        break;

      case 'viewCommit':
        if (action.hash) {
          const terminal = vscode.window.terminals.find(t => t.name === 'GitMind Terminal')
            || vscode.window.createTerminal('GitMind Terminal');
          terminal.show();
          terminal.sendText(`git show ${action.hash}`);
        }
        break;

      case 'connectGitHub':
        await vscode.commands.executeCommand('gitmind.connectGitHub');
        break;

      case 'webviewReady':
        await startBackgroundScan(context, sidebarProvider);
        break;

      case 'saveGeminiKey':
        if ((action as any).key) {
          try {
            await GeminiClient.complete((action as any).key, 'gemini-3.5-flash', 'You are a helpful assistant.', 'Hi');
            await AIProvider.setApiKey(context, (action as any).key);
            showInfo('Gemini API Key saved ✓');
            await startBackgroundScan(context, sidebarProvider);
          } catch (e: any) {
            if (e.message.includes('rate limit') || e.message.includes('429') || e.message.includes('Quota')) {
              await AIProvider.setApiKey(context, (action as any).key);
              showInfo('Gemini API Key saved ✓ (Quota rate limit warning)');
              await startBackgroundScan(context, sidebarProvider);
            } else {
              showError(`Gemini validation failed: ${e.message || e}`);
            }
          }
        }
        break;

      case 'saveGitHubTokenFromSettings':
        if ((action as any).token) {
          try {
            const client = new GitHubClient((action as any).token);
            const user = await client.getAuthenticatedUser();
            await context.secrets.store('gitmind.githubToken', (action as any).token);
            showInfo(`Connected to GitHub as @${user.login} ✓`);
            await startBackgroundScan(context, sidebarProvider);
          } catch (e: any) {
            showError('Invalid GitHub token. Ensure it has "repo" scope.');
          }
        }
        break;

      case 'disconnectGitHub':
        await context.secrets.delete('gitmind.githubToken');
        showInfo('GitHub account disconnected.');
        sidebarProvider.updateGitHubStatus(null);
        break;

      case 'disconnectGemini':
        await context.secrets.delete('gitmind.geminiApiKey');
        showInfo('Gemini account disconnected.');
        sidebarProvider.updateGeminiStatus(false);
        sidebarProvider.updateStatus('API Key missing ⚠', true);
        break;

      case 'openUrl':
        if (action.hash) { // Using 'hash' property passed in action as URL
          vscode.env.openExternal(vscode.Uri.parse(action.hash));
        } else if ((action as any).url) {
          vscode.env.openExternal(vscode.Uri.parse((action as any).url));
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
        const intent = parseGitHubIntent(query);
        if (intent.action !== 'unknown') {
          await handleGitHubAction(context, sidebarProvider, query);
        } else {
          await handleChatQuery(context, query, sidebarProvider, chatHistory);
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gitmind.connectGitHub', async () => {
      const token = await vscode.window.showInputBox({
        prompt: 'Paste your GitHub Personal Access Token',
        placeHolder: 'ghp_...',
        password: true,
        ignoreFocusOut: true
      });
      if (token) {
        try {
          const client = new GitHubClient(token);
          const user = await client.getAuthenticatedUser();
          await context.secrets.store('gitmind.githubToken', token);
          vscode.window.showInformationMessage(`Connected to GitHub as @${user.login} ✓`);
          await startBackgroundScan(context, sidebarProvider);
        } catch (e: any) {
          if (e.message === 'GITHUB_UNAUTHORIZED') {
            vscode.window.showErrorMessage('Invalid token. Create one at github.com/settings/tokens with repo scope.');
          } else {
            vscode.window.showErrorMessage(e.message || 'Validation failed.');
          }
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gitmind.disconnectGitHub', async () => {
      await context.secrets.delete('gitmind.githubToken');
      vscode.window.showInformationMessage('GitHub account disconnected.');
      sidebarProvider.updateGitHubStatus(null);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gitmind.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        prompt: 'Paste your Google Gemini API Key from aistudio.google.com',
        password: true,
        placeHolder: 'API Key...'
      });
      if (key) {
        try {
          await GeminiClient.complete(key, 'gemini-3.5-flash', 'You are a helpful assistant.', 'Hi');
          await AIProvider.setApiKey(context, key);
          showInfo('Gemini API Key saved ✓');
          await startBackgroundScan(context, sidebarProvider);
        } catch (e: any) {
          if (e.message.includes('rate limit') || e.message.includes('429') || e.message.includes('Quota')) {
            await AIProvider.setApiKey(context, key);
            showInfo('Gemini API Key saved ✓ (Quota rate limit warning)');
            await startBackgroundScan(context, sidebarProvider);
          } else if (e.message.includes('API key') || e.message.includes('403') || e.message.includes('Key')) {
            showError('Invalid key. Please check and try again.');
          } else {
            showError(e.message || 'Validation failed.');
          }
        }
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

  // Check API keys and startup scanning workflow
  const apiKey = await AIProvider.getApiKey(context);
  sidebarProvider.updateGeminiStatus(!!apiKey);
  if (!apiKey) {
    sidebarProvider.updateStatus('API Key missing ⚠', true);
    WelcomePanel.createOrShow(context, async () => {
      await startBackgroundScan(context, sidebarProvider);
    });
  } else {
    await startBackgroundScan(context, sidebarProvider);
  }
}

async function startBackgroundScan(context: vscode.ExtensionContext, sidebarProvider: GitMindSidebarProvider): Promise<void> {
  // Update Gemini key status in UI
  const apiKey = await AIProvider.getApiKey(context);
  sidebarProvider.updateGeminiStatus(!!apiKey);

  // Retrieve GitHub status first so it is always updated regardless of repository state
  const githubToken = await context.secrets.get('gitmind.githubToken');
  if (githubToken) {
    try {
      const client = new GitHubClient(githubToken);
      const user = await client.getAuthenticatedUser();
      sidebarProvider.updateGitHubStatus(user.login);
    } catch (e) {
      sidebarProvider.updateGitHubStatus(null);
    }
  } else {
    sidebarProvider.updateGitHubStatus(null);
  }

  // Update selected model in UI
  const model = AIProvider.getSelectedModel();
  sidebarProvider.updateModel(model);

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

async function getGitRemoteOwnerRepo(): Promise<{ owner: string; repo: string } | undefined> {
  const gitClient = getGitClient();
  if (!gitClient) { return undefined; }
  try {
    const remotes = await gitClient.getRemotes(true);
    const origin = remotes.find(r => r.name === 'origin') || remotes[0];
    if (!origin) { return undefined; }
    
    const url = origin.refs.push || origin.refs.fetch;
    if (!url) { return undefined; }

    const match = url.match(/github\.com[/:]([^/]+)\/([^.]+)(?:\.git)?/i);
    if (match) {
      return {
        owner: match[1],
        repo: match[2]
      };
    }
  } catch (e) {}
  return undefined;
}

async function handleGitHubAction(
  context: vscode.ExtensionContext,
  sidebarProvider: GitMindSidebarProvider,
  text: string
): Promise<void> {
  const token = await context.secrets.get('gitmind.githubToken');
  if (!token) {
    sidebarProvider.postMessage({
      command: 'githubError',
      type: 'githubError',
      text: 'Connect GitHub first via Connect GitHub Account command.'
    });
    return;
  }

  const intent = parseGitHubIntent(text);
  if (intent.action === 'unknown') {
    sidebarProvider.postMessage({
      command: 'githubError',
      type: 'githubError',
      text: 'Unknown GitHub action. Please rephrase.'
    });
    return;
  }

  const client = new GitHubClient(token);

  try {
    sidebarProvider.setThinking(true);
    let resultText = '';

    switch (intent.action) {
      case 'create_repo': {
        const name = intent.params.name;
        if (!name) {
          throw new Error('Repository name is missing. Please specify the name.');
        }
        const desc = intent.params.description || 'Repository created by GitMind';
        const isPrivate = intent.params.private === 'true';
        const repo = await client.createRepo(name, desc, isPrivate);
        resultText = `Created repository: <a class="github-link" onclick="openUrl('${repo.url}')">${name}</a> (Private: ${isPrivate ? 'yes' : 'no'}) ✓`;
        break;
      }

      case 'list_repos': {
        const repos = await client.listRepos();
        if (repos.length === 0) {
          resultText = 'No repositories found.';
        } else {
          resultText = repos
            .map(r => `• <a class="github-link" onclick="openUrl('${r.url}')">${r.fullName}</a> (Private: ${r.private ? 'yes' : 'no'})`)
            .join('<br/>');
        }
        break;
      }

      case 'create_branch': {
        const remote = await getGitRemoteOwnerRepo();
        if (!remote) {
          throw new Error('No GitHub remote origin configured in local git repository.');
        }
        const newBranch = intent.params.name || intent.params.to;
        if (!newBranch) {
          throw new Error('Branch name is missing. Please specify the branch name.');
        }
        const fromBranch = intent.params.from || 'main';
        await client.createBranch(remote.owner, remote.repo, newBranch, fromBranch);
        resultText = `Created branch <strong>${newBranch}</strong> from <strong>${fromBranch}</strong> on GitHub ✓`;
        break;
      }

      case 'create_pr': {
        const remote = await getGitRemoteOwnerRepo();
        if (!remote) {
          throw new Error('No GitHub remote origin configured in local git repository.');
        }
        const head = intent.params.from || intent.params.name;
        const base = intent.params.to || 'main';
        if (!head) {
          throw new Error('Source branch (head) is missing. Specify using "from <branch>".');
        }
        const title = intent.params.title || `PR from ${head} into ${base}`;
        const pr = await client.createPullRequest(remote.owner, remote.repo, title, 'Created via GitMind V2', head, base);
        resultText = `Created Pull Request: <a class="github-link" onclick="openUrl('${pr.url}')">#${pr.number}: ${title}</a> ✓`;
        break;
      }

      case 'merge_pr': {
        const remote = await getGitRemoteOwnerRepo();
        if (!remote) {
          throw new Error('No GitHub remote origin configured in local git repository.');
        }
        const prNum = parseInt(intent.params.prNumber, 10);
        if (isNaN(prNum)) {
          throw new Error('Pull request number is missing or invalid.');
        }
        await client.mergePullRequest(remote.owner, remote.repo, prNum);
        resultText = `Merged PR <strong>#${prNum}</strong> successfully ✓`;
        break;
      }

      case 'create_issue': {
        const remote = await getGitRemoteOwnerRepo();
        if (!remote) {
          throw new Error('No GitHub remote origin configured in local git repository.');
        }
        const title = intent.params.title;
        if (!title) {
          throw new Error('Issue title is missing. Specify after "issue:" or "issue titled".');
        }
        const issue = await client.createIssue(remote.owner, remote.repo, title, 'Created via GitMind V2');
        resultText = `Created Issue: <a class="github-link" onclick="openUrl('${issue.url}')">#${issue.number}: ${title}</a> ✓`;
        break;
      }

      case 'list_issues': {
        const remote = await getGitRemoteOwnerRepo();
        if (!remote) {
          throw new Error('No GitHub remote origin configured in local git repository.');
        }
        const issues = await client.listIssues(remote.owner, remote.repo);
        if (issues.length === 0) {
          resultText = 'No open issues found for this repository.';
        } else {
          resultText = issues
            .map(i => `• <a class="github-link" onclick="openUrl('${i.url}')">#${i.number}</a>: ${i.title}`)
            .join('<br/>');
        }
        break;
      }
    }

    sidebarProvider.setThinking(false);
    sidebarProvider.postMessage({
      command: 'githubResult',
      type: 'githubResult',
      text: resultText
    });
  } catch (e: any) {
    sidebarProvider.setThinking(false);
    let friendlyError = e.message || 'An error occurred during transaction.';
    if (e.message === 'GITHUB_UNAUTHORIZED') {
      friendlyError = "GitHub token expired or invalid. Run 'GitMind: Connect GitHub Account' to reconnect.";
    } else if (e.message === 'GITHUB_FORBIDDEN') {
      friendlyError = "You don't have permission for this action on this repo.";
    } else if (e.message === 'GITHUB_NOT_FOUND') {
      friendlyError = "Repo or resource not found. Check the name and try again.";
    } else if (e.message === 'GITHUB_UNPROCESSABLE') {
      friendlyError = "GitHub rejected this action. The branch or PR may already exist.";
    }

    sidebarProvider.postMessage({
      command: 'githubError',
      type: 'githubError',
      text: friendlyError
    });
  }
}

async function handleChatQuery(
  context: vscode.ExtensionContext,
  query: string,
  sidebarProvider: GitMindSidebarProvider,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string; isHtml?: boolean }>
): Promise<void> {
  // 1. Add user bubble and render immediately
  chatHistory.push({ role: 'user', content: query });
  sidebarProvider.updateChat(chatHistory);

  // 2. Show thinking state
  sidebarProvider.setThinking(true);

  try {
    const githubToken = await context.secrets.get('gitmind.githubToken');
    const intent = parseGitHubIntent(query);

    // 3. Process GitHub commands if matched
    if (intent.action !== 'unknown') {
      if (!githubToken) {
        sidebarProvider.setThinking(false);
        chatHistory.push({
          role: 'assistant',
          content: "Connect your GitHub account first. Click **Connect GitHub** below or in the quick actions.",
        });
        sidebarProvider.updateChat(chatHistory);
        return;
      }

      const client = new GitHubClient(githubToken);

      switch (intent.action) {
        case 'create_repo': {
          const name = intent.params.name;
          if (!name) {
            throw new Error('Repository name is missing. Please specify the name.');
          }
          const desc = intent.params.description || 'Repository created by GitMind';
          const isPrivate = intent.params.private === 'true';
          const repo = await client.createRepo(name, desc, isPrivate);
          
          chatHistory.push({
            role: 'assistant',
            content: `Created repository: <a class="github-link" onclick="openUrl('${repo.url}')">${name}</a> (Private: ${isPrivate ? 'yes' : 'no'}) ✓`,
            isHtml: true
          });
          break;
        }

        case 'list_repos': {
          const repos = await client.listRepos();
          if (repos.length === 0) {
            chatHistory.push({
              role: 'assistant',
              content: 'No repositories found.'
            });
          } else {
            const listHtml = repos
              .map(r => `• <a class="github-link" onclick="openUrl('${r.url}')">${r.fullName}</a> (Private: ${r.private ? 'yes' : 'no'})`)
              .join('<br/>');
            chatHistory.push({
              role: 'assistant',
              content: `<strong>Your active repositories:</strong><br/>${listHtml}`,
              isHtml: true
            });
          }
          break;
        }

        case 'create_branch': {
          const branchName = intent.params.name || intent.params.to;
          if (!branchName) {
            throw new Error('Branch name is missing. Please specify the branch name.');
          }
          const remote = await getGitRemoteOwnerRepo();
          if (!remote) {
            throw new Error('No GitHub remote origin configured in local git repository.');
          }
          const from = intent.params.from || 'main';
          await client.createBranch(remote.owner, remote.repo, branchName, from);
          
          chatHistory.push({
            role: 'assistant',
            content: `Created branch **${branchName}** from **${from}** on GitHub ✓`
          });
          break;
        }

        case 'create_pr': {
          const remote = await getGitRemoteOwnerRepo();
          if (!remote) {
            throw new Error('No GitHub remote origin configured in local git repository.');
          }
          const head = intent.params.from || intent.params.name;
          const base = intent.params.to || 'main';
          if (!head) {
            throw new Error('Source branch (head) is missing. E.g. "create PR from feature-branch to main"');
          }
          const title = intent.params.title || `PR from ${head} into ${base}`;
          const body = 'Pull request created automatically by GitMind V2.';
          
          const pr = await client.createPullRequest(remote.owner, remote.repo, title, body, head, base);
          
          chatHistory.push({
            role: 'assistant',
            content: `Created Pull Request: <a class="github-link" onclick="openUrl('${pr.url}')">#${pr.number}: ${title}</a> ✓`,
            isHtml: true
          });
          break;
        }

        case 'merge_pr': {
          const remote = await getGitRemoteOwnerRepo();
          if (!remote) {
            throw new Error('No GitHub remote origin configured in local git repository.');
          }
          const prNum = parseInt(intent.params.prNumber, 10);
          if (isNaN(prNum)) {
            throw new Error('Pull request number is missing or invalid. E.g. "merge PR #12"');
          }
          await client.mergePullRequest(remote.owner, remote.repo, prNum);
          chatHistory.push({
            role: 'assistant',
            content: `Merged PR **#${prNum}** successfully ✓`
          });
          break;
        }

        case 'create_issue': {
          const remote = await getGitRemoteOwnerRepo();
          if (!remote) {
            throw new Error('No GitHub remote origin configured in local git repository.');
          }
          const title = intent.params.title;
          if (!title) {
            throw new Error('Issue title is missing. E.g. "create issue: login button broken"');
          }
          const body = intent.params.body || 'Issue created automatically by GitMind V2.';
          const issue = await client.createIssue(remote.owner, remote.repo, title, body);
          
          chatHistory.push({
            role: 'assistant',
            content: `Created Issue: <a class="github-link" onclick="openUrl('${issue.url}')">#${issue.number}: ${title}</a> ✓`,
            isHtml: true
          });
          break;
        }

        case 'list_issues': {
          const remote = await getGitRemoteOwnerRepo();
          if (!remote) {
            throw new Error('No GitHub remote origin configured in local git repository.');
          }
          const issues = await client.listIssues(remote.owner, remote.repo);
          if (issues.length === 0) {
            chatHistory.push({
              role: 'assistant',
              content: 'No open issues found for this repository.'
            });
          } else {
            const listHtml = issues
              .map(i => `• <a class="github-link" onclick="openUrl('${i.url}')">#${i.number}</a>: ${i.title}`)
              .join('<br/>');
            chatHistory.push({
              role: 'assistant',
              content: `<strong>Open issues in ${remote.owner}/${remote.repo}:</strong><br/>${listHtml}`,
              isHtml: true
            });
          }
          break;
        }
      }
    } else {
      // 4. If unknown, run standard AI explain changes command
      const legacyHistory: ChatMessage[] = chatHistory.map(h => ({
        role: h.role,
        content: h.content
      }));

      // Directly invoke explainChangesCommand
      await explainChangesCommand(context, query, sidebarProvider, legacyHistory);

      // sync legacyHistory back into chatHistory
      chatHistory.splice(0, chatHistory.length);
      legacyHistory.forEach(h => {
        chatHistory.push({
          role: h.role,
          content: h.content
        });
      });
    }
  } catch (e: any) {
    let friendlyError = e.message || 'An error occurred during transaction.';
    if (e.message === 'GITHUB_UNAUTHORIZED') {
      friendlyError = "GitHub token expired or invalid. Run 'GitMind: Connect GitHub Account' to reconnect.";
    } else if (e.message === 'GITHUB_FORBIDDEN') {
      friendlyError = "You don't have permission for this action on this repo.";
    } else if (e.message === 'GITHUB_NOT_FOUND') {
      friendlyError = "Repo or resource not found. Check the name and try again.";
    } else if (e.message === 'GITHUB_UNPROCESSABLE') {
      friendlyError = "GitHub rejected this action. The branch or PR may already exist.";
    }

    chatHistory.push({
      role: 'assistant',
      content: `<div style="color: #f48771; font-weight:600;">GitHub Error:</div> ${friendlyError}`,
      isHtml: true
    });
  }

  sidebarProvider.setThinking(false);
  sidebarProvider.updateChat(chatHistory);
}

export function deactivate() {}
