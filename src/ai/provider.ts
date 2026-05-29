import * as vscode from 'vscode';
import { GeminiClient } from './gemini';
import { getSystemPrompt } from './prompts';
import { ProjectMemory } from '../storage/projectMemory';

export class AIProvider {
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

    // Retrieve cached GitHub username and append to systemPrompt
    const githubUsername = context.globalState.get<string>('gitmind.githubUsername');
    if (githubUsername) {
      systemPrompt += `\n\nActive GitHub Connection: Connected as user @${githubUsername}. You can answer questions about the user's identity using this username.`;
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
