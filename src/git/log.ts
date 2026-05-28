import { getGitClient } from './status';

export interface CommitSummary {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export async function getRecentCommits(count: number = 20): Promise<CommitSummary[]> {
  const client = getGitClient();
  if (!client) { return []; }
  try {
    const log = await client.log({ maxCount: count });
    return log.all.map(c => ({
      hash: c.hash,
      message: c.message,
      author: c.author_name,
      date: c.date
    }));
  } catch (e) {
    return [];
  }
}

export async function getCommitsOneline(count: number = 30): Promise<string> {
  const client = getGitClient();
  if (!client) { return ''; }
  try {
    // Run git log --oneline -30 via raw options
    const logResult = await client.raw(['log', `--max-count=${count}`, '--oneline']);
    return logResult.trim();
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}

export async function getBranchDiffCommits(yourBranch: string, incomingBranch: string, count: number = 5): Promise<string> {
  const client = getGitClient();
  if (!client) { return ''; }
  try {
    // Run git log --oneline <your-branch>...<incoming-branch> -5
    const logResult = await client.raw(['log', `${yourBranch}...${incomingBranch}`, `--max-count=${count}`, '--oneline']);
    return logResult.trim();
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}

export interface LogFilterOptions {
  since?: string;
  author?: string;
  file?: string;
  count?: number;
}

export async function getCommitsFiltered(options: LogFilterOptions): Promise<string> {
  const client = getGitClient();
  if (!client) { return 'No Git client available.'; }
  try {
    const args: string[] = ['log', '--oneline'];
    if (options.count) {
      args.push(`--max-count=${options.count}`);
    } else {
      args.push('--max-count=15'); // safety default
    }
    if (options.since) {
      args.push(`--since=${options.since}`);
    }
    if (options.author) {
      args.push(`--author=${options.author}`);
    }
    if (options.file) {
      args.push('--follow'); // follow history across renames if file specified
      args.push('--', options.file);
    }
    const logResult = await client.raw(args);
    return logResult.trim() || 'No matching commits found.';
  } catch (e: any) {
    return `Error retrieving commits: ${e.message}`;
  }
}
