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

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

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

  public updateChat(history: Array<{ role: string; content: string }>): void {
    if (this._view) {
      this._view.webview.postMessage({ type: 'chatHistory', history });
    }
  }

  public setLoader(visible: boolean, text: string = 'Loading...'): void {
    if (this._view) {
      this._view.webview.postMessage({ type: 'loader', visible, text });
    }
  }

  private _getHtmlForWebview(_webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitMind</title>
  <style>
    :root {
      --gitmind-accent: #8e2de2;
      --gitmind-accent-hover: #4a00e0;
      --gitmind-glow: rgba(142, 45, 226, 0.25);
    }
    
    body {
      padding: 10px;
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
      color: var(--vscode-foreground);
      background-color: var(--vscode-sideBar-background);
      margin: 0;
      display: flex;
      flex-direction: column;
      height: 100vh;
      box-sizing: border-box;
      font-size: var(--vscode-font-size, 13px);
    }

    .section {
      margin-bottom: 12px;
      flex-shrink: 0;
    }

    .card {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.1));
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
    }

    .status-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-weight: 600;
      font-size: 0.85em;
      padding: 3px 8px;
      border-radius: 12px;
      background: rgba(255,255,255,0.05);
    }

    .status-badge.ready {
      color: #4ec9b0;
      background: rgba(78, 201, 176, 0.1);
    }

    .status-badge.scanning {
      color: #ce9178;
      background: rgba(206, 145, 120, 0.1);
    }

    .status-badge.error {
      color: #f48771;
      background: rgba(244, 135, 113, 0.1);
    }

    label {
      font-weight: 600;
      display: block;
      margin-bottom: 6px;
      color: var(--vscode-descriptionForeground);
    }

    select, input, button {
      width: 100%;
      box-sizing: border-box;
      font-family: inherit;
      font-size: inherit;
      border-radius: 6px;
      transition: all 0.2s ease;
    }

    select {
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border, rgba(255,255,255,0.15));
      padding: 8px;
      outline: none;
      cursor: pointer;
    }

    select:focus {
      border-color: var(--gitmind-accent);
    }

    .btn {
      background: var(--vscode-button-background, var(--gitmind-accent));
      color: var(--vscode-button-foreground, #ffffff);
      border: none;
      padding: 10px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      box-shadow: 0 2px 6px var(--gitmind-glow);
    }

    .btn:hover {
      background: var(--vscode-button-hoverBackground, var(--gitmind-accent-hover));
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: transparent;
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-button-border, rgba(255,255,255,0.15));
      margin-top: 6px;
      box-shadow: none;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.05);
    }

    /* Main Scrollable Results Panel */
    .results-scrollable {
      flex: 1;
      overflow-y: auto;
      margin-bottom: 12px;
      border: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.08));
      border-radius: 8px;
      background: var(--vscode-editor-background);
      padding: 10px;
      min-height: 100px;
    }

    .placeholder-text {
      color: var(--vscode-descriptionForeground);
      text-align: center;
      padding: 20px;
      font-style: italic;
    }

    /* AI output styling */
    .ai-output {
      line-height: 1.5;
    }

    .ai-output p {
      margin: 0 0 10px 0;
    }

    .ai-output h3 {
      margin: 15px 0 8px 0;
      font-size: 1.1em;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      padding-bottom: 4px;
    }

    .risk-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 0.85em;
      margin-right: 6px;
    }

    .risk-high { background: rgba(244, 135, 113, 0.2); color: #f48771; }
    .risk-medium { background: rgba(220, 220, 0, 0.15); color: #dcdcaa; }
    .risk-low { background: rgba(78, 201, 176, 0.2); color: #4ec9b0; }

    .commit-card {
      border-left: 4px solid var(--gitmind-accent);
      background: rgba(255,255,255,0.02);
      border-radius: 0 8px 8px 0;
      padding: 10px;
      margin-bottom: 12px;
    }

    .commit-card.high { border-left-color: #f48771; }
    .commit-card.medium { border-left-color: #dcdcaa; }
    .commit-card.low { border-left-color: #4ec9b0; }

    .commit-header {
      display: flex;
      justify-content: space-between;
      font-weight: 600;
      margin-bottom: 6px;
    }

    .commit-hash {
      color: #569cd6;
      cursor: pointer;
      text-decoration: underline;
    }

    .commit-body {
      font-size: 0.95em;
      color: var(--vscode-foreground);
    }

    .commit-footer {
      margin-top: 6px;
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
    }

    .conflict-container {
      background: rgba(255, 255, 255, 0.02);
      border-radius: 8px;
      padding: 12px;
      border: 1px dashed var(--vscode-textSeparator-foreground);
    }

    .conflict-file {
      font-weight: bold;
      color: #ce9178;
      margin-bottom: 10px;
    }

    /* Loader */
    .loader {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
    }

    .spinner {
      border: 3px solid rgba(255,255,255,0.1);
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border-left-color: var(--gitmind-accent);
      animation: spin 1s linear infinite;
      margin-bottom: 10px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Chat Section */
    .chat-container {
      flex-shrink: 0;
      background: var(--vscode-editor-background);
      border-top: 1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.1));
      padding-top: 10px;
    }

    .chat-history {
      max-height: 140px;
      overflow-y: auto;
      margin-bottom: 8px;
      font-size: 0.9em;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 2px;
    }

    .chat-bubble {
      padding: 6px 10px;
      border-radius: 8px;
      max-width: 90%;
      line-height: 1.4;
      word-wrap: break-word;
    }

    .chat-bubble.user {
      align-self: flex-end;
      background: var(--gitmind-accent);
      color: #ffffff;
    }

    .chat-bubble.assistant {
      align-self: flex-start;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.05));
      color: var(--vscode-foreground);
    }

    .chat-input-wrapper {
      display: flex;
      gap: 6px;
    }

    .chat-input {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, rgba(255,255,255,0.15));
      padding: 8px 12px;
      outline: none;
    }

    .chat-input:focus {
      border-color: var(--gitmind-accent);
    }

    .chat-send-btn {
      width: auto;
      padding: 0 14px;
    }
  </style>
</head>
<body>
  
  <!-- Header / Settings -->
  <div class="section card">
    <div class="status-container">
      <span>Status:</span>
      <span id="status-badge" class="status-badge ready">Checking...</span>
    </div>
    
    <label for="model-select">AI Model</label>
    <select id="model-select" onchange="changeModel()">
      <option value="google/gemma-3-12b-it:free">google/gemma-3-12b-it:free (Fast, Free)</option>
      <option value="google/gemma-3-27b-it:free">google/gemma-3-27b-it:free (Smarter, Free)</option>
      <option value="deepseek/deepseek-r1:free">deepseek/deepseek-r1:free (Reasoning, Free)</option>
      <option value="meta-llama/llama-4-scout:free">meta-llama/llama-4-scout:free (Balanced, Free)</option>
      <option value="qwen/qwen3-235b-a22b:free">qwen/qwen3-235b-a22b:free (Capable, Free)</option>
      <option value="anthropic/claude-3.5-haiku">anthropic/claude-3.5-haiku (Fast, Paid)</option>
      <option value="openai/gpt-4o-mini">openai/gpt-4o-mini (Reliable, Paid)</option>
    </select>
  </div>

  <!-- Primary Operations -->
  <div class="section" style="display: flex; gap: 6px;">
    <button class="btn" style="flex: 1;" onclick="findBreakingCommit()">
      <span>🔴</span> Find Breaking Commit
    </button>
    <button class="btn btn-secondary" style="width: auto; margin-top: 0; padding: 0 10px;" title="Refresh Repository Context" onclick="refreshContext()">
      <span>🔄</span>
    </button>
  </div>

  <!-- Dynamic Results Scroll Area -->
  <div class="results-scrollable" id="results-panel">
    <div class="placeholder-text" id="placeholder-msg">
      No analyses run yet. Click 'Find Breaking Commit' or type in chat below.
    </div>
  </div>

  <!-- Chat Panel -->
  <div class="chat-container">
    <div class="chat-history" id="chat-history-panel"></div>
    <div class="chat-input-wrapper">
      <input type="text" class="chat-input" id="chat-query" placeholder="Ask about changes..." onkeydown="handleChatKeyDown(event)">
      <button class="btn chat-send-btn" onclick="sendChat()">Send</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    
    // Set initial model dropdown if passed previously
    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
        case 'status':
          const badge = document.getElementById('status-badge');
          badge.innerText = message.text;
          badge.className = 'status-badge ' + (message.isError ? 'error' : (message.text.toLowerCase().includes('scanning') ? 'scanning' : 'ready'));
          break;
        case 'model':
          document.getElementById('model-select').value = message.model;
          break;
        case 'loader':
          toggleLoader(message.visible, message.text);
          break;
        case 'result':
          renderResult(message.content, message.title);
          break;
        case 'error':
          renderError(message.message);
          break;
        case 'chatHistory':
          renderChatHistory(message.history);
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

    function refreshContext() {
      vscode.postMessage({ command: 'refreshContext' });
    }

    function handleChatKeyDown(event) {
      if (event.key === 'Enter') {
        sendChat();
      }
    }

    function sendChat() {
      const input = document.getElementById('chat-query');
      const val = input.value.trim();
      if (!val) return;
      
      vscode.postMessage({
        command: 'chatQuery',
        query: val
      });
      input.value = '';
    }

    function viewCommit(hash) {
      vscode.postMessage({
        command: 'viewCommit',
        hash: hash
      });
    }

    function toggleLoader(visible, text) {
      const panel = document.getElementById('results-panel');
      if (visible) {
        // Clear panel and add loader
        panel.innerHTML = \`
          <div class="loader">
            <div class="spinner"></div>
            <div>\${text}</div>
          </div>
        \`;
      }
    }

    function renderResult(content, title) {
      const panel = document.getElementById('results-panel');
      let header = title ? \`<h3 style="margin-top:0;">\${title}</h3>\` : '';
      panel.innerHTML = \`<div class="ai-output">\${header}\${content}</div>\`;
    }

    function renderError(message) {
      const panel = document.getElementById('results-panel');
      panel.innerHTML = \`
        <div style="color: #f48771; padding: 12px; background: rgba(244,135,113,0.1); border-radius: 8px; border: 1px solid rgba(244,135,113,0.2);">
          <strong style="display:block; margin-bottom: 4px;">Error Occurred:</strong>
          \${message}
        </div>
      \`;
    }

    function renderChatHistory(history) {
      const chatPanel = document.getElementById('chat-history-panel');
      chatPanel.innerHTML = '';
      if (!history || history.length === 0) return;

      history.forEach(msg => {
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble ' + (msg.role === 'user' ? 'user' : 'assistant');
        bubble.innerText = msg.content;
        chatPanel.appendChild(bubble);
      });
      
      // Auto scroll chat to bottom
      chatPanel.scrollTop = chatPanel.scrollHeight;
    }
  </script>
</body>
</html>`;
  }
}
