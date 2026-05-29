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
              await context.secrets.store('gitmind.geminiApiKey', message.key);
              this._panel.webview.postMessage({ type: 'showGithubStep' });
            } catch (e: any) {
              vscode.window.showErrorMessage(`Failed to save Gemini API key: ${e.message}`);
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
              
              // Close welcome panel after showing success
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
      --bg-gradient: linear-gradient(135deg, #09090b 0%, #18181b 100%);
      --accent-color: #ffffff;
      --accent-glow: rgba(255, 255, 255, 0.15);
      --accent-hover: #e4e4e7;
      --text-main: #f4f4f5;
      --text-muted: #a1a1aa;
      --card-bg: #18181b;
      --card-border: #27272a;
      --input-bg: #09090b;
    }

    body {
      background: var(--bg-gradient);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 40px 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      box-sizing: border-box;
    }

    .container {
      max-width: 500px;
      width: 100%;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      text-align: center;
      animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    h1 {
      font-size: 2rem;
      margin-bottom: 8px;
      background: linear-gradient(90deg, #ffffff, #a1a1aa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    p.subtitle {
      font-size: 0.95rem;
      color: var(--text-muted);
      margin-bottom: 24px;
    }

    .step-card {
      text-align: left;
      animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(10px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .step-header {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      color: var(--text-main);
    }

    .step-number {
      background: var(--accent-color);
      color: #09090b;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      margin-right: 10px;
      font-weight: 700;
    }

    .instruction-text {
      font-size: 0.88rem;
      color: var(--text-muted);
      line-height: 1.6;
      margin-bottom: 16px;
    }

    .input-group {
      display: flex;
      margin-top: 16px;
      gap: 8px;
    }

    input[type="password"] {
      flex: 1;
      background: var(--input-bg);
      border: 1px solid var(--card-border);
      padding: 10px 14px;
      border-radius: 6px;
      color: var(--text-main);
      font-size: 0.9rem;
      outline: none;
      transition: all 0.2s ease;
    }

    input[type="password"]:focus {
      border-color: #ffffff;
      box-shadow: 0 0 0 1px #ffffff;
    }

    .btn {
      background: var(--accent-color);
      color: #09090b;
      border: none;
      padding: 10px 20px;
      font-size: 0.9rem;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .btn:hover {
      background: var(--accent-hover);
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: transparent;
      color: var(--text-main);
      border: 1px solid var(--card-border);
      padding: 10px 18px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      text-decoration: none;
      display: inline-block;
      text-align: center;
      transition: all 0.2s;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: #ffffff;
      transform: translateY(-1px);
    }

    .link {
      color: #ffffff;
      text-decoration: underline;
      cursor: pointer;
    }

    .link:hover {
      text-decoration: underline;
    }

    .error-msg {
      color: #ff6b6b;
      font-size: 0.88rem;
      margin-top: 12px;
      display: none;
      background: rgba(255, 107, 107, 0.05);
      padding: 10px 14px;
      border-radius: 6px;
      border: 1px solid rgba(255, 107, 107, 0.15);
      text-align: left;
    }

    .success-msg {
      color: #ffffff;
      font-weight: 600;
      font-size: 1.05rem;
      margin-top: 20px;
      display: none;
    }

    .loading-spinner {
      display: none;
      align-items: center;
      gap: 10px;
      font-size: 0.9rem;
      color: var(--text-muted);
      margin-top: 15px;
    }

    .spinner {
      border: 2px solid rgba(255, 255, 255, 0.1);
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border-left-color: #ffffff;
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

    <!-- STEP 1: GEMINI KEY -->
    <div id="step-1" class="step-card">
      <div class="step-header">
        <span class="step-number">1</span>
        Google Gemini Connection
      </div>
      <div class="instruction-text">
        Step 1: Go to <span class="link" onclick="openUrl('https://aistudio.google.com/')">aistudio.google.com</span> → Sign in with Google → Click 'Get API Key' → Create API Key → Copy it.
        <br/><br/>
        Step 2: Paste your Gemini API key below:
      </div>
      <div class="input-group">
        <input type="password" id="apiKey" placeholder="Paste Gemini API Key..." autocomplete="off">
        <button class="btn" onclick="saveStep1()">Save Key & Get Started</button>
      </div>
    </div>

    <!-- STEP 2: GITHUB TOKEN -->
    <div id="step-2" class="step-card" style="display: none;">
      <div class="step-header">
        <span class="step-number">2</span>
        Connect GitHub <span class="optional">(Optional)</span>
      </div>
      <div class="instruction-text">
        Link your GitHub account to create repos, branches, PRs, and issues directly from chat.
        <br/><br/>
        Create a token at <span class="link" onclick="openUrl('https://github.com/settings/tokens')">github.com/settings/tokens</span> 
        — select <strong>repo</strong> scope only.
      </div>
      
      <div class="input-group">
        <input type="password" id="githubToken" placeholder="ghp_..." autocomplete="off">
        <button class="btn" onclick="saveGithubToken()">Connect GitHub</button>
        <button class="btn-secondary" onclick="skipGithub()">Skip for now</button>
      </div>

      <div id="validation-spinner" class="loading-spinner">
        <div class="spinner"></div>
        <span>Verifying token with GitHub...</span>
      </div>

      <div id="error-box" class="error-msg"></div>
      <div id="success-box" class="success-msg"></div>
      <p id="githubStatus"></p>
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
        alert('Please enter your Gemini API Key.');
        return;
      }
      vscode.postMessage({
        command: 'saveKey',
        key: key
      });
    }

    function saveGithubToken() {
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

    function skipGithub() {
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
