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

  private _getHtmlForWebview(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitMind</title>
  <style>
    :root {
      --gitmind-accent: var(--vscode-button-background, #8e2de2);
      --gitmind-accent-hover: var(--vscode-button-hoverBackground, #4a00e0);
      --gitmind-glow: rgba(142, 45, 226, 0.15);
      --border-color: var(--vscode-widget-border, rgba(255, 255, 255, 0.08));
    }
    
    body {
      padding: 0;
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
      color: var(--vscode-foreground);
      background-color: var(--vscode-sideBar-background);
      margin: 0;
      display: flex;
      flex-direction: column;
      height: 100vh;
      box-sizing: border-box;
      font-size: var(--vscode-font-size, 13px);
      overflow: hidden;
    }

    /* Fixed Header */
    .header {
      background: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--border-color);
      padding: 12px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 10;
    }

    .header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .brand-title {
      font-weight: 700;
      font-size: 1.15em;
      display: flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(90deg, #00f2fe, #8e2de2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
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
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--border-color);
    }

    .status-badge.ready { color: #4ec9b0; }
    .status-badge.scanning { color: #ce9178; }
    .status-badge.error { color: #f48771; }

    .github-status {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-weight: 500;
      color: var(--vscode-descriptionForeground);
    }

    .github-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      display: inline-block;
      background: #888888;
    }
    .github-dot.connected {
      background: #4ec9b0;
      box-shadow: 0 0 6px #4ec9b0;
    }

    /* Model Select dropdown */
    .model-select-wrapper {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    select {
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border, rgba(255,255,255,0.15));
      padding: 6px;
      border-radius: 4px;
      outline: none;
      cursor: pointer;
      font-size: 0.95em;
    }
    select:focus {
      border-color: var(--gitmind-accent);
    }

    /* Scrollable Chat Area */
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: var(--vscode-sideBar-background);
    }

    /* Message Bubbles */
    .bubble {
      max-width: 85%;
      padding: 10px 12px;
      border-radius: 12px;
      line-height: 1.45;
      word-wrap: break-word;
      animation: bubbleFadeIn 0.25s ease-out;
      font-size: 0.95em;
    }

    @keyframes bubbleFadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .bubble.user {
      align-self: flex-end;
      background: var(--gitmind-accent);
      color: var(--vscode-button-foreground, #ffffff);
      border-bottom-right-radius: 2px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    }

    .bubble.assistant {
      align-self: flex-start;
      background: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      border-bottom-left-radius: 2px;
      border: 1px solid var(--border-color);
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .bubble.thinking {
      align-self: flex-start;
      background: var(--vscode-editor-background);
      border: 1px solid var(--border-color);
      border-bottom-left-radius: 2px;
      font-style: italic;
      color: var(--vscode-descriptionForeground);
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
      background-color: var(--vscode-descriptionForeground);
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
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.9em;
    }

    .assistant pre {
      background: rgba(0, 0, 0, 0.15);
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
      border-left: 4px solid var(--gitmind-accent);
      background: rgba(255,255,255,0.02);
      border-radius: 0 6px 6px 0;
      padding: 8px;
      margin: 8px 0;
      border: 1px solid var(--border-color);
      border-left-width: 4px;
    }
    .commit-card.high { border-left-color: #f48771; }
    .commit-card.medium { border-left-color: #dcdcaa; }
    .commit-card.low { border-left-color: #4ec9b0; }

    .commit-header {
      display: flex;
      justify-content: space-between;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .commit-hash {
      color: #569cd6;
      cursor: pointer;
      text-decoration: underline;
    }

    /* Quick Action Buttons (shown when chat is empty) */
    .quick-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 20px 10px;
      margin: auto 0;
      align-items: center;
      animation: fadeIn 0.4s ease-out;
    }

    .welcome-text {
      text-align: center;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 16px;
      font-size: 0.95em;
    }

    .action-btn {
      background: var(--vscode-editor-background);
      border: 1px solid var(--border-color);
      color: var(--vscode-foreground);
      padding: 10px 14px;
      border-radius: 8px;
      cursor: pointer;
      width: 85%;
      text-align: left;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.2s ease;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    }
    .action-btn:hover {
      border-color: var(--gitmind-accent);
      background: rgba(255,255,255,0.03);
      transform: translateY(-1px);
    }

    .action-icon {
      font-size: 1.2em;
    }

    /* Fixed Input Box at Bottom */
    .input-container {
      background: var(--vscode-sideBar-background);
      border-top: 1px solid var(--border-color);
      padding: 10px;
      flex-shrink: 0;
      display: flex;
      gap: 8px;
      align-items: flex-end;
      box-shadow: 0 -2px 8px rgba(0,0,0,0.1);
    }

    .chat-input {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, rgba(255,255,255,0.15));
      border-radius: 6px;
      padding: 8px 10px;
      outline: none;
      resize: none;
      font-family: inherit;
      font-size: inherit;
      max-height: 80px;
      min-height: 20px;
      line-height: 1.4;
      box-sizing: border-box;
    }
    .chat-input:focus {
      border-color: var(--gitmind-accent);
    }

    .send-btn {
      background: var(--gitmind-accent);
      color: var(--vscode-button-foreground, #ffffff);
      border: none;
      border-radius: 6px;
      padding: 8px 12px;
      cursor: pointer;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 34px;
      transition: background-color 0.2s;
    }
    .send-btn:hover {
      background: var(--gitmind-accent-hover);
    }

    /* Links inside assistant bubbles */
    .github-link {
      color: #569cd6;
      text-decoration: underline;
      cursor: pointer;
    }
  </style>
</head>
<body>
  
  <!-- Header -->
  <div class="header">
    <div class="header-top">
      <div class="brand-title">🧠 GitMind V2</div>
      <div id="scan-badge" class="status-badge ready">Checking...</div>
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

  <!-- Messages scroll area -->
  <div class="chat-messages" id="chat-messages-panel">
    <!-- Quick Actions when empty -->
    <div class="quick-actions" id="quick-actions-panel">
      <div class="welcome-text">Select a quick action or type a command below.</div>
      
      <button class="action-btn" onclick="findBreakingCommit()">
        <span class="action-icon">🔍</span>
        <span>Find Breaking Commit</span>
      </button>
      
      <button class="action-btn" onclick="explainConflict()">
        <span class="action-icon">⚡</span>
        <span>Explain Conflict</span>
      </button>

      <button class="action-btn" onclick="listRepos()">
        <span class="action-icon">📋</span>
        <span>List My Repos</span>
      </button>

      <button class="action-btn" onclick="connectGitHub()">
        <span class="action-icon">🔗</span>
        <span>Connect GitHub</span>
      </button>
    </div>
  </div>

  <!-- Input Area -->
  <div class="input-container">
    <textarea class="chat-input" id="chat-input" placeholder="Ask about git or run GitHub commands..." rows="1" onkeydown="handleInputKeyDown(event)"></textarea>
    <button class="send-btn" onclick="submitMessage()">Send</button>
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
          if (message.username) {
            dot.className = 'github-dot connected';
            label.innerText = 'Connected: @' + message.username;
          } else {
            dot.className = 'github-dot';
            label.innerText = 'Not connected';
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
      escaped = escaped.replace(/\`\`\`([\s\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>');
      // Translate inline code
      escaped = escaped.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
      
      // Parse markdown links [text](url)
      escaped = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a class="github-link" onclick="openUrl(\'$2\')">$1</a>');

      return escaped.replace(/\n/g, '<br/>');
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
  </script>
</body>
</html>`;
  }
}
