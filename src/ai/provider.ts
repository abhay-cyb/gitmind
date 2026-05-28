import * as vscode from 'vscode';
import { OpenRouterClient } from './openrouter';
import { getSystemPrompt } from './prompts';
import { ProjectMemory } from '../storage/projectMemory';

export class AIProvider {
  public static async getApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
    return await context.secrets.get('gitmind.openrouterApiKey');
  }

  public static async setApiKey(context: vscode.ExtensionContext, key: string): Promise<void> {
    await context.secrets.store('gitmind.openrouterApiKey', key);
  }

  public static getSelectedModel(): string {
    return vscode.workspace
      .getConfiguration('gitmind')
      .get<string>('openrouterModel', 'google/gemini-2.0-flash-exp:free');
  }

  public static async setSelectedModel(model: string): Promise<void> {
    await vscode.workspace
      .getConfiguration('gitmind')
      .update('openrouterModel', model, vscode.ConfigurationTarget.Global);
  }

  public static async callAI(
    context: vscode.ExtensionContext,
    userPrompt: string,
    options?: { model?: string; isBreakingCommitAnalysis?: boolean }
  ): Promise<string> {
    const apiKey = await this.getApiKey(context);
    if (!apiKey) {
      throw new Error('API Key not found. Please set your OpenRouter API Key first.');
    }

    const model = options?.model || this.getSelectedModel();
    
    // Load local project context
    const projectContext = ProjectMemory.readContext() || 'No project context available.';
    const systemPrompt = getSystemPrompt(projectContext, options?.isBreakingCommitAnalysis);

    return await OpenRouterClient.completions(apiKey, model, systemPrompt, userPrompt);
  }
}
