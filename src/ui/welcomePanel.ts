import * as vscode from 'vscode';

export class WelcomePanel {
  public static currentPanel: WelcomePanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(onSaveKey: (key: string) => void): void {
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

    WelcomePanel.currentPanel = new WelcomePanel(panel, onSaveKey);
  }

  private constructor(panel: vscode.WebviewPanel, onSaveKey: (key: string) => void) {
    this._panel = panel;

    this._panel.webview.html = this._getHtmlForWebview();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'saveKey':
            onSaveKey(message.key);
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
      animation: fadeIn 0.8s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
      background: linear-gradient(90deg, #00f2fe, #4a00e0);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-weight: 700;
    }

    p.subtitle {
      font-size: 1.1rem;
      color: var(--text-muted);
      margin-bottom: 30px;
    }

    .features {
      text-align: left;
      margin: 30px 0;
      padding: 20px;
      background: rgba(0, 0, 0, 0.15);
      border-radius: 12px;
      border: 1px solid var(--card-border);
    }

    .feature-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 15px;
    }

    .feature-item:last-child {
      margin-bottom: 0;
    }

    .feature-icon {
      font-size: 1.5rem;
      margin-right: 15px;
      color: #00f2fe;
    }

    .feature-text h3 {
      margin: 0 0 5px 0;
      font-size: 1rem;
      color: var(--text-main);
    }

    .feature-text p {
      margin: 0;
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    .setup-steps {
      margin-top: 40px;
      text-align: left;
    }

    .step {
      margin-bottom: 25px;
    }

    .step-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
    }

    .step-number {
      background: var(--accent-color);
      color: #ffffff;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      margin-right: 10px;
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
      transform: translateY(-2px);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: var(--text-main);
      box-shadow: none;
      border: 1px solid var(--card-border);
      text-decoration: none;
      display: inline-block;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
      box-shadow: none;
      transform: translateY(-2px);
    }

    .input-group {
      display: flex;
      margin-top: 10px;
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

    .footer-links {
      margin-top: 30px;
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .footer-links a {
      color: #00f2fe;
      text-decoration: none;
      margin: 0 10px;
    }

    .footer-links a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>GitMind</h1>
    <p class="subtitle">AI-Powered Git Intelligence inside VS Code</p>

    <div class="features">
      <div class="feature-item">
        <div class="feature-icon">🔍</div>
        <div class="feature-text">
          <h3>Repository Context Scanner</h3>
          <p>Scans files and commits in the background to supply local context to the AI.</p>
        </div>
      </div>
      <div class="feature-item">
        <div class="feature-icon">🔴</div>
        <div class="feature-text">
          <h3>Breaking Commit Detector</h3>
          <p>Instantly spot suspicious commits causing bugs or service failures.</p>
        </div>
      </div>
      <div class="feature-item">
        <div class="feature-icon">📌</div>
        <div class="feature-text">
          <h3>Merge Conflict Explainer</h3>
          <p>Explains lines causing conflict and advises on resolution steps.</p>
        </div>
      </div>
    </div>

    <div class="setup-steps">
      <div class="step">
        <div class="step-title">
          <span class="step-number">1</span>
          Get your OpenRouter API Key
        </div>
        <button class="btn btn-secondary" onclick="openOpenRouter()">Open openrouter.ai</button>
      </div>

      <div class="step">
        <div class="step-title">
          <span class="step-number">2</span>
          Paste your API Key
        </div>
        <div class="input-group">
          <input type="password" id="apiKey" placeholder="sk-or-v1-..." autocomplete="off">
          <button class="btn" onclick="saveKey()">Save Key & Get Started</button>
        </div>
      </div>
    </div>

    <div class="footer-links">
      <a href="#" onclick="openModels()">View Free Models Available</a>
      <span>•</span>
      <span>Privacy-conscious: Code is never uploaded. Only git metadata.</span>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function openOpenRouter() {
      vscode.postMessage({
        command: 'openUrl',
        url: 'https://openrouter.ai/'
      });
    }

    function openModels() {
      vscode.postMessage({
        command: 'openUrl',
        url: 'https://openrouter.ai/models?q=free'
      });
    }

    function saveKey() {
      const key = document.getElementById('apiKey').value.trim();
      if (!key) {
        alert('Please enter a valid API key.');
        return;
      }
      vscode.postMessage({
        command: 'saveKey',
        key: key
      });
    }
  </script>
</body>
</html>`;
  }
}
