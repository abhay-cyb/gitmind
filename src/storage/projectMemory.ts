import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class ProjectMemory {
  public static getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      return folders[0].uri.fsPath;
    }
    return undefined;
  }

  public static getContextPath(): string | undefined {
    const root = this.getWorkspaceRoot();
    if (!root) { return undefined; }
    return path.join(root, '.gitmind', 'project-context.md');
  }

  public static readContext(): string | undefined {
    const contextPath = this.getContextPath();
    if (!contextPath || !fs.existsSync(contextPath)) {
      return undefined;
    }
    try {
      return fs.readFileSync(contextPath, 'utf8');
    } catch (e) {
      return undefined;
    }
  }

  public static writeContext(content: string): void {
    const contextPath = this.getContextPath();
    if (!contextPath) { return; }
    
    const dir = path.dirname(contextPath);
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(contextPath, content, 'utf8');
      this.ensureGitignore();
    } catch (e) {
      // Ignore or log error
    }
  }

  public static ensureGitignore(): void {
    const root = this.getWorkspaceRoot();
    if (!root) { return; }

    const gitignorePath = path.join(root, '.gitignore');
    try {
      let content = '';
      if (fs.existsSync(gitignorePath)) {
        content = fs.readFileSync(gitignorePath, 'utf8');
      }

      // Check if .gitmind/ or .gitmind is already ignored
      const lines = content.split(/\r?\n/);
      const isIgnored = lines.some(line => {
        const trimmed = line.trim();
        return trimmed === '.gitmind' || trimmed === '.gitmind/' || trimmed.startsWith('.gitmind/');
      });

      if (!isIgnored) {
        const separator = (content.endsWith('\n') || content === '') ? '' : '\n';
        fs.appendFileSync(gitignorePath, `${separator}.gitmind/\n`, 'utf8');
      }
    } catch (e) {
      // Ignore gitignore write failures
    }
  }
}
