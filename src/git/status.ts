import simpleGit, { SimpleGit } from 'simple-git';
import { ProjectMemory } from '../storage/projectMemory';

export function getGitClient(): SimpleGit | undefined {
  const root = ProjectMemory.getWorkspaceRoot();
  if (!root) { return undefined; }
  return simpleGit(root);
}

export async function isGitRepository(): Promise<boolean> {
  const client = getGitClient();
  if (!client) { return false; }
  try {
    return await client.checkIsRepo();
  } catch (e) {
    return false;
  }
}

export async function getGitStatus(): Promise<string> {
  const client = getGitClient();
  if (!client) { return 'No workspace folder open.'; }
  try {
    const status = await client.status();
    let output = `Branch: ${status.current || 'unknown'}\n`;
    if (status.files.length === 0) {
      output += 'No modified or unstaged files.';
    } else {
      output += 'Modified/Unstaged files:\n';
      status.files.forEach(f => {
        output += `  ${f.path} (${f.working_dir || f.index})\n`;
      });
    }
    return output;
  } catch (e: any) {
    return `Error reading git status: ${e.message}`;
  }
}

export async function getCurrentBranch(): Promise<string | undefined> {
  const client = getGitClient();
  if (!client) { return undefined; }
  try {
    const status = await client.status();
    return status.current || undefined;
  } catch (e) {
    return undefined;
  }
}
