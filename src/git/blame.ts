import { getGitClient } from './status';

export async function getFileBlame(file: string): Promise<string> {
  const client = getGitClient();
  if (!client) { return ''; }
  try {
    return await client.raw(['blame', file]);
  } catch (e: any) {
    return `Error running git blame for ${file}: ${e.message}`;
  }
}
