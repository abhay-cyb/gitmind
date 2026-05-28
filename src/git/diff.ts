import { getGitClient } from './status';

export async function getCommitStat(hash: string): Promise<string> {
  const client = getGitClient();
  if (!client) { return ''; }
  try {
    // Run git show <hash> --stat
    return await client.show([hash, '--stat']);
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}

export async function getCommitFileDiff(hash: string, file: string): Promise<string> {
  const client = getGitClient();
  if (!client) { return ''; }
  try {
    // Run git show <hash> -- <file>
    return await client.show([hash, '--', file]);
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}

export async function getDiffSince(timestamp: string): Promise<string> {
  const client = getGitClient();
  if (!client) { return ''; }
  try {
    // Run git diff since a timestamp
    // We can do it by querying git log -p --since=<timestamp>
    return await client.raw(['log', '-p', `--since=${timestamp}`]);
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}
