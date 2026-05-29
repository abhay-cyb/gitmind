import * as vscode from 'vscode';
import { GeminiClient } from './gemini';
import { getSystemPrompt } from './prompts';
import { ProjectMemory } from '../storage/projectMemory';

import { GitHubClient } from '../github/githubClient';

export class AIProvider {
  private static githubCache: {
    username: string;
    name: string;
    reposText: string;
    timestamp: number;
  } | null = null;

  public static async getApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
    return await context.secrets.get('gitmind.geminiApiKey');
  }

  public static async setApiKey(context: vscode.ExtensionContext, key: string): Promise<void> {
    await context.secrets.store('gitmind.geminiApiKey', key);
  }

  public static getSelectedModel(): string {
    return vscode.workspace
      .getConfiguration('gitmind')
      .get<string>('geminiModel', 'gemini-3.5-flash');
  }

  public static async setSelectedModel(model: string): Promise<void> {
    await vscode.workspace
      .getConfiguration('gitmind')
      .update('geminiModel', model, vscode.ConfigurationTarget.Global);
  }

  public static async callAI(
    context: vscode.ExtensionContext,
    userPrompt: string,
    options?: { model?: string; isBreakingCommitAnalysis?: boolean }
  ): Promise<string> {
    const apiKey = await this.getApiKey(context);
    if (!apiKey) {
      throw new Error('API Key not found. Please set your Gemini API Key first.');
    }

    const model = options?.model || this.getSelectedModel();
    
    // Load local project context
    const projectContext = ProjectMemory.readContext() || 'No project context available.';
    let systemPrompt = getSystemPrompt(projectContext, options?.isBreakingCommitAnalysis);

    // Fetch and cache user GitHub profile & repositories
    const githubToken = await context.secrets.get('gitmind.githubToken');
    if (githubToken) {
      const now = Date.now();
      if (this.githubCache && (now - this.githubCache.timestamp < 30000)) {
        systemPrompt += `\n\nGitHub Profile: Connected as @${this.githubCache.username} (${this.githubCache.name})
GitHub Repositories (sorted by last updated, newest first):
${this.githubCache.reposText}`;
      } else {
        try {
          const client = new GitHubClient(githubToken);
          const user = await client.getAuthenticatedUser();
          const repos = await client.listRepos();
          const reposText = repos.map(r => `- ${r.fullName} (Private: ${r.private ? 'yes' : 'no'}, Created At: ${r.createdAt}, Updated At: ${r.updatedAt}, URL: ${r.url})`).join('\n');
          
          this.githubCache = {
            username: user.login,
            name: user.name,
            reposText,
            timestamp: now
          };

          systemPrompt += `\n\nGitHub Profile: Connected as @${user.login} (${user.name})
GitHub Repositories (sorted by last updated, newest first):
${reposText}`;

          await context.globalState.update('gitmind.githubUsername', user.login);
        } catch (e) {
          this.githubCache = null;
          await context.globalState.update('gitmind.githubUsername', undefined);
        }
      }
    }

    // Retrieve cached git repository details and append to systemPrompt
    const repoOwner = context.globalState.get<string>('gitmind.repoOwner');
    const repoName = context.globalState.get<string>('gitmind.repoName');
    const activeBranch = context.globalState.get<string>('gitmind.activeBranch');
    if (repoOwner && repoName) {
      systemPrompt += `\n\nLocal Git Repository: ${repoOwner}/${repoName}`;
    }
    if (activeBranch) {
      systemPrompt += `\nActive Git Branch: ${activeBranch}`;
    }

    return await GeminiClient.complete(apiKey, model, systemPrompt, userPrompt);
  }
}
