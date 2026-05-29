import * as vscode from 'vscode';

export class GitMindSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'gitmind.sidebar';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _onAction: (action: {
      command: string;
      model?: string;
      query?: string;
      hash?: string;
    }) => void
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview();

    webviewView.webview.onDidReceiveMessage(data => {
      this._onAction(data);
    });
  }

  public updateStatus(statusText: string, isError: boolean = false): void {
    if (this._view) {
      this._view.webview.postMessage({ type: 'status', text: statusText, isError });
    }
  }

  public updateModel(model: string): void {
    if (this._view) {
      this._view.webview.postMessage({ type: 'model', model });
    }
  }

  public updateGitHubStatus(username: string | null): void {
    if (this._view) {
      this._view.webview.postMessage({ type: 'githubStatus', username });
    }
  }

  public showResult(resultHtml: string, title?: string): void {
    if (this._view) {
      this._view.webview.postMessage({ type: 'result', content: resultHtml, title });
    }
  }

  public showError(errorMsg: string): void {
    if (this._view) {
      this._view.webview.postMessage({ type: 'error', message: errorMsg });
    }
  }

  public updateChat(history: Array<{ role: string; content: string; isHtml?: boolean }>): void {
    if (this._view) {
      this._view.webview.postMessage({ type: 'chatHistory', history });
    }
  }

  public setLoader(visible: boolean, text: string = 'Loading...'): void {
    if (this._view) {
      this._view.webview.postMessage({ type: 'loader', visible, text });
    }
  }

  public setThinking(visible: boolean): void {
    if (this._view) {
      this._view.webview.postMessage({ type: 'thinking', visible });
    }
  }

  public postMessage(message: any): void {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  private _getHtmlForWebview(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitMind</title>
  <style>
    :root {
      --gitmind-accent: #ffffff;
      --gitmind-accent-hover: #e4e4e7;
      --border-color: #27272a;
      --bg-main: #09090b;
      --bg-card: #18181b;
      --text-main: #f4f4f5;
      --text-muted: #a1a1aa;
    }
    
    body {
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: var(--text-main);
      background-color: var(--bg-main);
      margin: 0;
      display: flex;
      flex-direction: column;
      height: 100vh;
      box-sizing: border-box;
      font-size: 13px;
      overflow: hidden;
    }

    /* Fixed Header */
    .header {
      background: var(--bg-card);
      border-bottom: 1px solid var(--border-color);
      padding: 12px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 10;
    }

    .header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .brand-title {
      font-weight: 700;
      font-size: 1.1em;
      display: flex;
      align-items: center;
      gap: 6px;
      color: #ffffff;
      letter-spacing: -0.01em;
    }

    .status-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.85em;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 500;
      font-size: 0.82em;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--bg-main);
      border: 1px solid var(--border-color);
    }

    .status-badge.ready { color: var(--text-muted); }
    .status-badge.scanning { color: #ffffff; }
    .status-badge.error { color: #ff6b6b; }

    .github-status {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-weight: 500;
      color: var(--text-muted);
    }

    .github-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      display: inline-block;
      background: #52525b;
    }
    .github-dot.connected {
      background: #ffffff;
      box-shadow: 0 0 6px #ffffff;
    }

    /* Model Select dropdown */
    .model-select-wrapper {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    select {
      background: var(--bg-main);
      color: #ffffff;
      border: 1px solid var(--border-color);
      padding: 6px;
      border-radius: 4px;
      outline: none;
      cursor: pointer;
      font-size: 0.9em;
      transition: border-color 0.2s;
    }
    select:focus {
      border-color: #ffffff;
    }

    /* Scrollable Chat Area */
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: var(--bg-main);
    }
    .chat-messages::-webkit-scrollbar,
    .settings-panel::-webkit-scrollbar {
      width: 4px;
    }
    .chat-messages::-webkit-scrollbar-track,
    .settings-panel::-webkit-scrollbar-track {
      background: transparent;
    }
    .chat-messages::-webkit-scrollbar-thumb,
    .settings-panel::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 2px;
    }

    /* Message Bubbles */
    .bubble {
      max-width: 85%;
      padding: 10px 12px;
      border-radius: 8px;
      line-height: 1.5;
      word-wrap: break-word;
      animation: bubbleFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
      font-size: 0.92em;
    }

    @keyframes bubbleFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .bubble.user {
      align-self: flex-end;
      background: #ffffff;
      color: #09090b;
      font-weight: 500;
      border-bottom-right-radius: 1px;
    }

    .bubble.assistant {
      align-self: flex-start;
      background: var(--bg-card);
      color: var(--text-main);
      border-bottom-left-radius: 1px;
      border: 1px solid var(--border-color);
    }

    .bubble.thinking {
      align-self: flex-start;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-bottom-left-radius: 1px;
      font-style: italic;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .thinking-dots {
      display: inline-flex;
      gap: 3px;
    }
    .thinking-dots span {
      width: 5px;
      height: 5px;
      background-color: var(--text-muted);
      border-radius: 50%;
      animation: pulse 1.4s infinite both;
    }
    .thinking-dots span:nth-child(2) { animation-delay: .2s; }
    .thinking-dots span:nth-child(3) { animation-delay: .4s; }

    @keyframes pulse {
      0%, 100% { transform: scale(0.6); opacity: 0.4; }
      50% { transform: scale(1.2); opacity: 1; }
    }

    /* Code & Markdown styled outputs inside assistant bubbles */
    .assistant code {
      background: rgba(255,255,255,0.06);
      padding: 2px 4px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.9em;
    }

    .assistant pre {
      background: #000000;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 8px;
      overflow-x: auto;
      margin: 8px 0;
    }
    .assistant pre code {
      background: transparent;
      padding: 0;
    }

    /* Risk indicators */
    .commit-card {
      border-left: 3px solid #ffffff;
      background: rgba(255,255,255,0.01);
      border-radius: 0 6px 6px 0;
      padding: 8px;
      margin: 8px 0;
      border: 1px solid var(--border-color);
      border-left-width: 3px;
    }
    .commit-card.high { border-left-color: #ff6b6b; }
    .commit-card.medium { border-left-color: #f1c40f; }
    .commit-card.low { border-left-color: #a1a1aa; }

    .commit-header {
      display: flex;
      justify-content: space-between;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .commit-hash {
      color: #ffffff;
      cursor: pointer;
      text-decoration: underline;
    }

    /* Quick Action Buttons (shown when chat is empty) */
    .quick-actions {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 20px 10px;
      margin: auto 0;
      align-items: center;
      width: 100%;
      box-sizing: border-box;
      animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    .welcome-text {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.95em;
    }

    .quick-actions-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      width: 100%;
      max-width: 280px;
    }

    .action-btn {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      padding: 16px 10px;
      border-radius: 12px;
      cursor: pointer;
      font-weight: 500;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 8px;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .action-btn:hover {
      border-color: #ffffff;
      background: rgba(255,255,255,0.03);
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(255,255,255,0.05);
    }

    .action-icon {
      font-size: 1.4em;
    }

    .action-text {
      font-size: 0.85em;
      line-height: 1.25;
    }

    /* Fixed Input Box at Bottom */
    .input-container {
      background: var(--bg-card);
      border-top: 1px solid var(--border-color);
      padding: 12px 12px 20px 12px;
      flex-shrink: 0;
      display: flex;
      gap: 8px;
      align-items: center;
      box-sizing: border-box;
    }

    .chat-input {
      flex: 1;
      background: var(--bg-main);
      color: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 18px;
      padding: 8px 14px;
      outline: none;
      resize: none;
      font-family: inherit;
      font-size: inherit;
      max-height: 80px;
      min-height: 20px;
      line-height: 1.4;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }
    .chat-input:focus {
      border-color: #ffffff;
    }

    .send-btn {
      background: #ffffff;
      color: #09090b;
      border: none;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      min-width: 32px;
      padding: 0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .send-btn:hover {
      background: #e4e4e7;
      transform: scale(1.05);
    }

    /* Links inside assistant bubbles */
    .github-link {
      color: #ffffff;
      text-decoration: underline;
      cursor: pointer;
    }

    .icon-btn {
      background: transparent;
      border: none;
      color: #ffffff;
      cursor: pointer;
      font-size: 1.2em;
      padding: 2px 6px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s;
    }
    .icon-btn:hover {
      background-color: rgba(255,255,255,0.08);
    }

    /* Settings Panel styling */
    .settings-panel {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      background: var(--bg-main);
    }
    .settings-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .settings-section h3 {
      margin: 0;
      font-size: 1em;
      font-weight: 600;
      color: #ffffff;
    }
    .settings-row-input {
      display: flex;
      gap: 8px;
    }
    .settings-row-input input {
      flex: 1;
      background: var(--bg-card);
      color: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 8px 12px;
      outline: none;
      font-size: 0.92em;
      transition: border-color 0.2s;
    }
    .settings-row-input input:focus {
      border-color: #ffffff;
    }
    .settings-btn {
      background: #ffffff;
      color: #09090b;
      border: none;
      border-radius: 6px;
      padding: 8px 14px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.9em;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .settings-btn:hover {
      background: #e4e4e7;
      transform: translateY(-1px);
    }
    .settings-btn.disconnect-btn {
      background: #ff6b6b;
      color: #ffffff;
      width: 100%;
    }
    .settings-btn.disconnect-btn:hover {
      background: #ff4a4a;
    }
    .settings-btn.close-btn {
      background: transparent;
      color: var(--text-main);
      border: 1px solid var(--border-color);
      width: 100%;
    }
    .settings-btn.close-btn:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: #ffffff;
    }
    .settings-note {
      margin: 0;
      font-size: 0.85em;
      color: var(--text-muted);
    }
    .connected-user {
      margin: 4px 0 8px 0;
      font-size: 0.95em;
    }
  </style>
</head>
<body>
  
  <!-- Header -->
  <div class="header">
    <div class="header-top">
      <div class="brand-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #ffffff;">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
        </svg>
        <span>GitMind V2</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button id="settings-toggle-btn" class="icon-btn" onclick="toggleSettings()" title="Settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
        <div id="scan-badge" class="status-badge ready">Checking...</div>
      </div>
    </div>
    
    <div class="status-row">
      <div class="github-status">
        <span id="github-dot" class="github-dot"></span>
        <span id="github-label">Not connected</span>
      </div>
    </div>

    <div class="model-select-wrapper">
      <select id="model-select" onchange="changeModel()">
        <option value="gemini-2.0-flash">Gemini 2.0 Flash ⭐ Recommended</option>
        <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite (Fastest)</option>
        <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
        <option value="gemini-1.5-pro">Gemini 1.5 Pro (Most Capable)</option>
      </select>
    </div>
  </div>

  <!-- Settings Panel -->
  <div id="settings-panel" class="settings-panel" style="display: none;">
    <div class="settings-section">
      <h3>Gemini API Key</h3>
      <div class="settings-row-input">
        <input type="password" id="settings-gemini-key" placeholder="Paste Gemini API Key..." />
        <button class="settings-btn" onclick="saveGeminiKeyFromSettings()">Save</button>
      </div>
      <p class="settings-note">Get a key at <span class="github-link" onclick="openUrl('https://aistudio.google.com/')">Google AI Studio</span></p>
    </div>

    <div class="settings-section">
      <h3>GitHub Connection</h3>
      <div id="settings-github-connected" style="display: none;">
        <p class="connected-user">Connected as <strong id="settings-github-username">@username</strong></p>
        <button class="settings-btn disconnect-btn" onclick="disconnectGitHubFromSettings()">Disconnect GitHub</button>
      </div>
      <div id="settings-github-disconnected">
        <div class="settings-row-input">
          <input type="password" id="settings-github-token" placeholder="Paste ghp_..." />
          <button class="settings-btn" onclick="connectGitHubFromSettings()">Connect</button>
        </div>
        <p class="settings-note">Create token with <code>repo</code> scope at <span class="github-link" onclick="openUrl('https://github.com/settings/tokens')">github.com</span></p>
      </div>
    </div>

    <div class="settings-section" style="margin-top: auto; padding-top: 20px;">
      <button class="settings-btn close-btn" onclick="toggleSettings()">Back to Chat</button>
    </div>
  </div>

  <!-- Messages scroll area -->
  <div class="chat-messages" id="chat-messages-panel">
    <!-- Quick Actions when empty -->
    <div class="quick-actions" id="quick-actions-panel">
      <div class="welcome-text">Select a quick action or type a command below.</div>
      
      <div class="quick-actions-grid">
        <button class="action-btn" onclick="findBreakingCommit()">
          <span class="action-icon">🔍</span>
          <span class="action-text">Find Breaking Commit</span>
        </button>
        
        <button class="action-btn" onclick="explainConflict()">
          <span class="action-icon">⚡</span>
          <span class="action-text">Explain Conflict</span>
        </button>

        <button class="action-btn" onclick="listRepos()">
          <span class="action-icon">📋</span>
          <span class="action-text">List My Repos</span>
        </button>

        <button class="action-btn" onclick="connectGitHub()">
          <span class="action-icon">🔗</span>
          <span class="action-text">Connect GitHub</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Input Area -->
  <div class="input-container">
    <textarea class="chat-input" id="chat-input" placeholder="Ask about git or run GitHub commands..." rows="1" onkeydown="handleInputKeyDown(event)"></textarea>
    <button class="send-btn" onclick="submitMessage()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    </button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const chatPanel = document.getElementById('chat-messages-panel');
    const input = document.getElementById('chat-input');

    // Message receiver
    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
        case 'status':
          const badge = document.getElementById('scan-badge');
          badge.innerText = message.text;
          badge.className = 'status-badge ' + (message.isError ? 'error' : (message.text.toLowerCase().includes('scanning') ? 'scanning' : 'ready'));
          break;
          
        case 'githubStatus':
          const dot = document.getElementById('github-dot');
          const label = document.getElementById('github-label');
          const settingsConnected = document.getElementById('settings-github-connected');
          const settingsDisconnected = document.getElementById('settings-github-disconnected');
          const settingsUsername = document.getElementById('settings-github-username');
          
          if (message.username) {
            dot.className = 'github-dot connected';
            label.innerText = 'Connected: @' + message.username;
            
            if (settingsUsername) settingsUsername.innerText = '@' + message.username;
            if (settingsConnected) settingsConnected.style.display = 'block';
            if (settingsDisconnected) settingsDisconnected.style.display = 'none';
          } else {
            dot.className = 'github-dot';
            label.innerText = 'Not connected';
            
            if (settingsConnected) settingsConnected.style.display = 'none';
            if (settingsDisconnected) settingsDisconnected.style.display = 'block';
          }
          break;

        case 'model':
          document.getElementById('model-select').value = message.model;
          break;

        case 'chatHistory':
          renderHistory(message.history);
          break;

        case 'thinking':
          toggleThinking(message.visible);
          break;

        case 'error':
          appendError(message.message);
          break;

        case 'result':
          // Existing commands legacy fallback compatibility
          appendResult(message.content, message.title);
          break;

        case 'githubResult':
          toggleThinking(false);
          const resBubble = document.createElement('div');
          resBubble.className = 'bubble assistant';
          resBubble.innerHTML = message.text;
          chatPanel.appendChild(resBubble);
          chatPanel.scrollTop = chatPanel.scrollHeight;
          break;

        case 'githubError':
          toggleThinking(false);
          const errBubble = document.createElement('div');
          errBubble.className = 'bubble assistant';
          errBubble.style.borderColor = '#f48771';
          errBubble.style.background = 'rgba(244,135,113,0.05)';
          errBubble.innerHTML = '<span style="color:#f48771; font-weight:600;">GitHub Error:</span> ' + message.text;
          chatPanel.appendChild(errBubble);
          chatPanel.scrollTop = chatPanel.scrollHeight;
          break;
      }
    });

    function changeModel() {
      const modelVal = document.getElementById('model-select').value;
      vscode.postMessage({
        command: 'changeModel',
        model: modelVal
      });
    }

    function findBreakingCommit() {
      vscode.postMessage({ command: 'findBreakingCommit' });
    }

    function explainConflict() {
      vscode.postMessage({ command: 'explainConflict' });
    }

    function listRepos() {
      vscode.postMessage({
        command: 'chatQuery',
        query: 'list my repos'
      });
    }

    // Runs connectGitHub command in extension
    function connectGitHub() {
      vscode.postMessage({ command: 'connectGitHub' });
    }

    function handleInputKeyDown(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        submitMessage();
      }
    }

    function submitMessage() {
      const text = input.value.trim();
      if (!text) return;
      
      vscode.postMessage({
        command: 'chatQuery',
        query: text
      });
      
      input.value = '';
      adjustInputHeight();
    }

    function adjustInputHeight() {
      input.style.height = 'auto';
      input.style.height = input.scrollHeight + 'px';
    }
    input.addEventListener('input', adjustInputHeight);

    // Callbacks inside bubbles
    function viewCommit(hash) {
      vscode.postMessage({
        command: 'viewCommit',
        hash: hash
      });
    }

    function openUrl(url) {
      // In webview, post message to extension to open external URI
      vscode.postMessage({
        command: 'openUrl',
        url: url
      });
    }

    function renderHistory(history) {
      const quickActions = document.getElementById('quick-actions-panel');
      
      // Remove thinking bubble before rendering history
      toggleThinking(false);

      if (history && history.length > 0) {
        if (quickActions) {
          quickActions.style.display = 'none';
        }
        
        // Save current thinking state
        chatPanel.innerHTML = '';
        history.forEach(msg => {
          const bubble = document.createElement('div');
          bubble.className = 'bubble ' + (msg.role === 'user' ? 'user' : 'assistant');
          if (msg.isHtml) {
            bubble.innerHTML = msg.content;
          } else {
            // Very basic markdown translation for ticks and code blocks
            bubble.innerHTML = formatMessageText(msg.content);
          }
          chatPanel.appendChild(bubble);
        });
      } else {
        chatPanel.innerHTML = '';
        if (quickActions) {
          quickActions.style.display = 'flex';
          chatPanel.appendChild(quickActions);
        }
      }
      chatPanel.scrollTop = chatPanel.scrollHeight;
    }

    function formatMessageText(text) {
      // Escape HTML
      let escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      // Translate code blocks
      escaped = escaped.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>');
      // Translate inline code
      escaped = escaped.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
      
      // Parse markdown links [text](url)
      escaped = escaped.replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s\\)]+)\\)/g, '<a class="github-link" onclick="openUrl(\\\'$2\\\')">$1</a>');

      return escaped.replace(/\\n/g, '<br/>');
    }

    function toggleThinking(visible) {
      const existing = document.getElementById('thinking-bubble');
      if (visible && !existing) {
        const bubble = document.createElement('div');
        bubble.id = 'thinking-bubble';
        bubble.className = 'bubble thinking';
        bubble.innerHTML = '<span>Thinking</span><span class="thinking-dots"><span></span><span></span><span></span></span>';
        chatPanel.appendChild(bubble);
        chatPanel.scrollTop = chatPanel.scrollHeight;
      } else if (!visible && existing) {
        existing.remove();
      }
    }

    function appendError(msg) {
      toggleThinking(false);
      const bubble = document.createElement('div');
      bubble.className = 'bubble assistant';
      bubble.style.borderColor = '#f48771';
      bubble.style.background = 'rgba(244,135,113,0.05)';
      bubble.innerHTML = '<span style="color:#f48771; font-weight:600;">Error:</span> ' + msg;
      chatPanel.appendChild(bubble);
      chatPanel.scrollTop = chatPanel.scrollHeight;
    }

    function appendResult(content, title) {
      // Legacy commands display compatibility inside bubble
      toggleThinking(false);
      const bubble = document.createElement('div');
      bubble.className = 'bubble assistant';
      let titleHtml = title ? ('<h4 style="margin: 0 0 6px 0; border-bottom: 1px solid var(--border-color); padding-bottom:4px;">' + title + '</h4>') : '';
      bubble.innerHTML = titleHtml + content;
      chatPanel.appendChild(bubble);
      chatPanel.scrollTop = chatPanel.scrollHeight;
    }

    let settingsOpen = false;
    function toggleSettings() {
      settingsOpen = !settingsOpen;
      const chatPanel = document.getElementById('chat-messages-panel');
      const inputContainer = document.querySelector('.input-container');
      const settingsPanel = document.getElementById('settings-panel');
      const toggleBtn = document.getElementById('settings-toggle-btn');
      
      if (settingsOpen) {
        chatPanel.style.display = 'none';
        inputContainer.style.display = 'none';
        settingsPanel.style.display = 'flex';
        toggleBtn.innerText = '✕';
        toggleBtn.title = 'Close Settings';
      } else {
        chatPanel.style.display = 'flex';
        inputContainer.style.display = 'flex';
        settingsPanel.style.display = 'none';
        toggleBtn.innerText = '⚙';
        toggleBtn.title = 'Settings';
      }
    }

    function saveGeminiKeyFromSettings() {
      const key = document.getElementById('settings-gemini-key').value.trim();
      if (!key) {
        alert('Please enter a Gemini API Key.');
        return;
      }
      vscode.postMessage({
        command: 'saveGeminiKey',
        key: key
      });
      document.getElementById('settings-gemini-key').value = '';
    }

    function connectGitHubFromSettings() {
      const token = document.getElementById('settings-github-token').value.trim();
      if (!token) {
        alert('Please enter a GitHub token.');
        return;
      }
      vscode.postMessage({
        command: 'saveGitHubTokenFromSettings',
        token: token
      });
      document.getElementById('settings-github-token').value = '';
    }

    function disconnectGitHubFromSettings() {
      vscode.postMessage({
        command: 'disconnectGitHub'
      });
    }
  </script>
</body>
</html>`;
  }
}
