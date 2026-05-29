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
      .get<string>('geminiModel', 'gemini-2.0-flash');
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
    const systemPrompt = getSystemPrompt(projectContext, options?.isBreakingCommitAnalysis);

    return await GeminiClient.complete(apiKey, model, systemPrompt, userPrompt);
  }
}
