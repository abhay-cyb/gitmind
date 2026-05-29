import * as vscode from 'vscode';
import { getCommitsFiltered, LogFilterOptions } from '../git/log';
import { AIProvider } from '../ai/provider';
import { getChangeSummarizerPrompt } from '../ai/prompts';
import { GitMindSidebarProvider } from '../ui/sidebar';
import { isGitRepository } from '../git/status';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function explainChangesCommand(
  context: vscode.ExtensionContext,
  query: string,
  sidebarProvider: GitMindSidebarProvider,
  chatHistory: ChatMessage[]
): Promise<void> {
  try {
    const hasGit = await isGitRepository();
    const isGitQuery = /commit|change|diff|log|history|yesterday|today|week|day|what's new|added|fixed/i.test(query);

    let response: string;

    if (hasGit && isGitQuery) {
      sidebarProvider.setLoader(true, 'Reading git logs for your query...');
      const filterOptions = parseQuery(query);
      const commits = await getCommitsFiltered(filterOptions);
      sidebarProvider.setLoader(true, 'Summarizing changes...');
      const userPrompt = getChangeSummarizerPrompt(query, commits);
      response = await AIProvider.callAI(context, userPrompt);
    } else {
      sidebarProvider.setLoader(true, 'Thinking...');
      response = await AIProvider.callAI(context, query);
    }

    // Keep last 5 exchanges (10 messages total: 5 user, 5 assistant)
    const lastMsg = chatHistory[chatHistory.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== query) {
      chatHistory.push({ role: 'user', content: query });
    }
    chatHistory.push({ role: 'assistant', content: response });

    if (chatHistory.length > 10) {
      chatHistory.splice(0, chatHistory.length - 10);
    }

    sidebarProvider.setLoader(false);
    sidebarProvider.updateChat(chatHistory);
  } catch (e: any) {
    sidebarProvider.setLoader(false);
    
    const lastMsg = chatHistory[chatHistory.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== query) {
      chatHistory.push({ role: 'user', content: query });
    }
    chatHistory.push({
      role: 'assistant',
      content: `<span style="color: #f48771; font-weight:600;">Error:</span> ${e.message || e}`
    });
    sidebarProvider.updateChat(chatHistory);
  }
}

function parseQuery(query: string): LogFilterOptions {
  const options: LogFilterOptions = { count: 15 };
  const lower = query.toLowerCase();

  // Time filters
  if (lower.includes('yesterday')) {
    options.since = '1.day.ago';
  } else if (lower.includes('today')) {
    options.since = 'today';
  } else if (lower.includes('this week')) {
    options.since = '1.week.ago';
  } else if (lower.includes('last 3 days')) {
    options.since = '3.days.ago';
  } else if (lower.includes('last 5 days')) {
    options.since = '5.days.ago';
  } else if (lower.includes('last 7 days')) {
    options.since = '7.days.ago';
  }

  // Count override
  const countMatch = lower.match(/last\s+(\d+)\s+commits?/);
  if (countMatch) {
    options.count = parseInt(countMatch[1], 10);
  }

  // Author filters
  // e.g. "by John" or "commits by John"
  const authorMatch = lower.match(/(?:by|author:)\s*([a-zA-Z0-9_-]+)/);
  if (authorMatch) {
    options.author = authorMatch[1];
  }

  // File filters (very simple heuristics looking for extensions or common files)
  const words = lower.split(/\s+/);
  for (const word of words) {
    if (word.includes('.') || word.includes('/') || word.includes('\\')) {
      // Remove symbols like quotes
      const cleanWord = word.replace(/['"`,]/g, '');
      options.file = cleanWord;
      break;
    }
  }

  // If no explicit file was matched but keyword was found
  if (!options.file) {
    if (lower.includes('auth') || lower.includes('login') || lower.includes('signup')) {
      options.file = 'auth';
    } else if (lower.includes('config') || lower.includes('settings')) {
      options.file = 'config';
    } else if (lower.includes('database') || lower.includes(' db ')) {
      options.file = 'db';
    } else if (lower.includes('package') || lower.includes('dependencies')) {
      options.file = 'package.json';
    }
  }

  return options;
}
