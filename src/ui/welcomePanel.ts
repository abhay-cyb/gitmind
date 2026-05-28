import * as vscode from 'vscode';
import { GitHubClient } from '../github/githubClient';

export class WelcomePanel {
  public static currentPanel: WelcomePanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(context: vscode.ExtensionContext, onFinish: () => void): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (WelcomePanel.currentPanel) {
      WelcomePanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'gitmindWelcome',
      'Welcome to GitMind',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    WelcomePanel.currentPanel = new WelcomePanel(panel, context, onFinish);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    onFinish: () => void
  ) {
    this._panel = panel;

    this._panel.webview.html = this._getHtmlForWebview();

    this._panel.onDidDispose(() => {
      this.dispose();
      onFinish();
    }, null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'saveKey':
            try {
              await context.secrets.store('gitmind.openrouterApiKey', message.key);
              this._panel.webview.postMessage({ type: 'showGithubStep' });
            } catch (e: any) {
              vscode.window.showErrorMessage(`Failed to save OpenRouter key: ${e.message}`);
            }
            break;

          case 'saveGithubToken':
            try {
              // Show validation state in webview
              this._panel.webview.postMessage({ type: 'githubValidating' });

              const client = new GitHubClient(message.token);
              const user = await client.getAuthenticatedUser();
              
              await context.secrets.store('gitmind.githubToken', message.token);
              
              this._panel.webview.postMessage({ 
                type: 'githubConnected', 
                username: user.login 
              });
              
              // Close welcomed panel after showing success
              setTimeout(() => {
                this.dispose();
              }, 1200);
            } catch (e: any) {
              this._panel.webview.postMessage({ 
                type: 'githubError', 
                message: e.message || 'Validation failed. Check your token and permissions.' 
              });
            }
            break;

          case 'skipGithub':
            this.dispose();
            break;

          case 'openUrl':
            vscode.env.openExternal(vscode.Uri.parse(message.url));
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public dispose(): void {
    WelcomePanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _getHtmlForWebview(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to GitMind</title>
  <style>
    :root {
      --bg-gradient: linear-gradient(135deg, #1e1e30 0%, #0f0f1a 100%);
      --accent-color: #8e2de2;
      --accent-glow: rgba(142, 45, 226, 0.4);
      --accent-hover: #4a00e0;
      --text-main: #f0f0f0;
      --text-muted: #aaaaaa;
      --card-bg: rgba(255, 255, 255, 0.05);
      --card-border: rgba(255, 255, 255, 0.08);
      --input-bg: rgba(0, 0, 0, 0.2);
    }

    body {
      background: var(--bg-gradient);
      color: var(--text-main);
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 40px 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      box-sizing: border-box;
    }

    .container {
      max-width: 600px;
      width: 100%;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(8px);
      text-align: center;
      animation: fadeIn 0.5s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 5px;
      background: linear-gradient(90deg, #00f2fe, #8e2de2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-weight: 700;
    }

    p.subtitle {
      font-size: 1.1rem;
      color: var(--text-muted);
      margin-bottom: 25px;
    }

    .step-card {
      text-align: left;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .step-header {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      color: #00f2fe;
    }

    .step-number {
      background: var(--accent-color);
      color: #ffffff;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      margin-right: 12px;
      font-weight: bold;
      box-shadow: 0 0 8px var(--accent-glow);
    }

    .instruction-text {
      font-size: 0.95rem;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 16px;
    }

    .input-group {
      display: flex;
      margin-top: 15px;
      gap: 10px;
    }

    input[type="password"] {
      flex: 1;
      background: var(--input-bg);
      border: 1px solid var(--card-border);
      padding: 12px;
      border-radius: 8px;
      color: var(--text-main);
      font-size: 1rem;
      outline: none;
      transition: border-color 0.3s;
    }

    input[type="password"]:focus {
      border-color: #00f2fe;
    }

    .btn {
      background: var(--accent-color);
      color: #ffffff;
      border: none;
      padding: 12px 24px;
      font-size: 1rem;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px var(--accent-glow);
    }

    .btn:hover {
      background: var(--accent-hover);
      box-shadow: 0 6px 20px var(--accent-glow);
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-main);
      box-shadow: none;
      border: 1px solid var(--card-border);
      padding: 12px 20px;
      border-radius: 8px;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      text-align: center;
      transition: all 0.2s;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.12);
      transform: translateY(-1px);
    }

    .link {
      color: #00f2fe;
      text-decoration: none;
      cursor: pointer;
    }
    .link:hover {
      text-decoration: underline;
    }

    .error-msg {
      color: #f48771;
      font-size: 0.9em;
      margin-top: 10px;
      display: none;
      background: rgba(244,135,113,0.1);
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid rgba(244,135,113,0.2);
    }

    .success-msg {
      color: #4ec9b0;
      font-weight: 600;
      font-size: 1.1em;
      margin-top: 15px;
      display: none;
    }

    .loading-spinner {
      display: none;
      align-items: center;
      gap: 10px;
      font-style: italic;
      color: var(--text-muted);
      margin-top: 10px;
    }

    .spinner {
      border: 3px solid rgba(255,255,255,0.1);
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border-left-color: #00f2fe;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>GitMind V2</h1>
    <p class="subtitle">AI-Powered Git Intelligence & GitHub Co-Authoring</p>

    <!-- STEP 1: OPENROUTER KEY -->
    <div id="step-1" class="step-card">
      <div class="step-header">
        <span class="step-number">1</span>
        OpenRouter Connection
      </div>
      <div class="instruction-text">
        GitMind uses OpenRouter models for explaining breaking commits, code changes, and merge conflicts. 
        Get a key at <span class="link" onclick="openUrl('https://openrouter.ai/')">openrouter.ai</span>.
      </div>
      <div class="input-group">
        <input type="password" id="apiKey" placeholder="Paste sk-or-v1-..." autocomplete="off">
        <button class="btn" onclick="saveStep1()">Next Step</button>
      </div>
    </div>

    <!-- STEP 2: GITHUB TOKEN -->
    <div id="step-2" class="step-card" style="display: none;">
      <div class="step-header">
        <span class="step-number">2</span>
        GitHub Integration (Optional)
      </div>
      <div class="instruction-text">
        Connect your GitHub account to create repos, branches, issues, and Pull Requests using natural language chat. 
        <br/>
        Create a Personal Access Token (PAT) at 
        <span class="link" onclick="openUrl('https://github.com/settings/tokens')">github.com/settings/tokens</span> 
        (make sure to select the <strong>repo</strong> scope).
      </div>
      
      <div class="input-group">
        <input type="password" id="githubToken" placeholder="Paste ghp_..." autocomplete="off">
        <button class="btn" onclick="saveStep2()">Connect GitHub</button>
        <button class="btn-secondary" onclick="skipStep2()">Skip for now</button>
      </div>

      <div id="validation-spinner" class="loading-spinner">
        <div class="spinner"></div>
        <span>Verifying token with GitHub...</span>
      </div>

      <div id="error-box" class="error-msg"></div>
      <div id="success-box" class="success-msg"></div>
    </div>

  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function openUrl(url) {
      vscode.postMessage({
        command: 'openUrl',
        url: url
      });
    }

    function saveStep1() {
      const key = document.getElementById('apiKey').value.trim();
      if (!key) {
        alert('Please enter your OpenRouter API Key.');
        return;
      }
      vscode.postMessage({
        command: 'saveKey',
        key: key
      });
    }

    function saveStep2() {
      const token = document.getElementById('githubToken').value.trim();
      if (!token) {
        alert('Please enter a GitHub Token.');
        return;
      }
      vscode.postMessage({
        command: 'saveGithubToken',
        token: token
      });
    }

    function skipStep2() {
      vscode.postMessage({
        command: 'skipGithub'
      });
    }

    // Message receiver
    window.addEventListener('message', event => {
      const msg = event.data;
      switch (msg.type) {
        case 'showGithubStep':
          document.getElementById('step-1').style.display = 'none';
          document.getElementById('step-2').style.display = 'block';
          break;

        case 'githubValidating':
          document.getElementById('validation-spinner').style.display = 'flex';
          document.getElementById('error-box').style.display = 'none';
          document.getElementById('success-box').style.display = 'none';
          break;

        case 'githubConnected':
          document.getElementById('validation-spinner').style.display = 'none';
          document.getElementById('error-box').style.display = 'none';
          const successBox = document.getElementById('success-box');
          successBox.innerText = 'Connected as @' + msg.username + ' ✓';
          successBox.style.display = 'block';
          break;

        case 'githubError':
          document.getElementById('validation-spinner').style.display = 'none';
          const errBox = document.getElementById('error-box');
          errBox.innerText = msg.message;
          errBox.style.display = 'block';
          break;
      }
    });
  </script>
</body>
</html>`;
  }
}
