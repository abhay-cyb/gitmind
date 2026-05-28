import * as fs from 'fs';
import * as path from 'path';
import { ProjectMemory } from '../storage/projectMemory';
import { getRecentCommits } from '../git/log';
import { getGitClient } from '../git/status';
import { ArchitectureAnalyzer, ScanData } from './architectureAnalyzer';

export class RepoScanner {
  private static readonly IGNORE_DIRS = new Set([
    'node_modules', '.git', '.gitmind', '.vscode', 'dist', 'build', 'target', 'bin', 'obj', 'out'
  ]);

  public static async scan(force: boolean = false): Promise<{ success: boolean; message: string }> {
    const root = ProjectMemory.getWorkspaceRoot();
    if (!root) {
      return { success: false, message: 'No workspace folder open.' };
    }

    try {
      const existingContext = ProjectMemory.readContext();
      if (existingContext && !force) {
        const lastScannedMatch = existingContext.match(/Last Scanned:\s*([^\n\r]+)/);
        if (lastScannedMatch) {
          const lastScannedTime = new Date(lastScannedMatch[1].trim());
          const now = new Date();
          const diffMs = now.getTime() - lastScannedTime.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);

          if (diffHours < 24) {
            // Under 24 hours, skip scan
            return { success: true, message: 'Context ready ✓ (loaded from cache)' };
          }
        }
      }

      // Perform full scan
      const scanData = await this.performScan(root);
      const contextContent = ArchitectureAnalyzer.analyze(scanData);
      ProjectMemory.writeContext(contextContent);

      return { success: true, message: 'Context ready ✓' };
    } catch (e: any) {
      return { success: false, message: `Scan failed: ${e.message}` };
    }
  }

  private static async performScan(root: string): Promise<ScanData> {
    const folderStructure: string[] = [];
    const manifests: { [filename: string]: string } = {};
    let readme: string | undefined;
    let dockerfile: string | undefined;
    let dockerCompose: string | undefined;
    const envKeys: string[] = [];
    const modifiedFiles: string[] = [];

    // Scan directories up to 3 levels deep
    this.scanDir(root, root, 1, folderStructure, manifests);

    // Specific file mappings from manifestations
    const readmePath = path.join(root, 'README.md');
    if (fs.existsSync(readmePath)) {
      try {
        readme = fs.readFileSync(readmePath, 'utf8').substring(0, 1500); // sample top of README
      } catch (e) {}
    }

    const dockerfilePath = path.join(root, 'Dockerfile');
    if (fs.existsSync(dockerfilePath)) {
      try {
        dockerfile = fs.readFileSync(dockerfilePath, 'utf8');
      } catch (e) {}
    }

    const dockerComposePath = path.join(root, 'docker-compose.yml');
    if (fs.existsSync(dockerComposePath)) {
      try {
        dockerCompose = fs.readFileSync(dockerComposePath, 'utf8');
      } catch (e) {}
    }

    // Redact and parse env keys
    const envPath = path.join(root, '.env');
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split(/\r?\n/);
        lines.forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex !== -1) {
              const key = trimmed.substring(0, eqIndex).trim();
              envKeys.push(`${key}=[REDACTED]`);
            } else {
              envKeys.push(`${trimmed}=[REDACTED]`);
            }
          }
        });
      } catch (e) {}
    }

    // Get recent commits
    const recentCommits = await getRecentCommits(20);

    // Get modified files from git status
    const gitClient = getGitClient();
    if (gitClient) {
      try {
        const status = await gitClient.status();
        status.files.forEach(f => {
          modifiedFiles.push(f.path);
        });
      } catch (e) {}
    }

    return {
      folderStructure,
      manifests,
      readme,
      dockerfile,
      dockerCompose,
      envKeys,
      recentCommits,
      modifiedFiles
    };
  }

  private static scanDir(
    rootDir: string,
    currentDir: string,
    depth: number,
    folderStructure: string[],
    manifests: { [filename: string]: string }
  ): void {
    if (depth > 3) { return; }

    try {
      const items = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          if (this.IGNORE_DIRS.has(item.name)) { continue; }
          const dirPath = path.join(currentDir, item.name);
          const relPath = path.relative(rootDir, dirPath);
          folderStructure.push(relPath + '/');
          this.scanDir(rootDir, dirPath, depth + 1, folderStructure, manifests);
        } else {
          const filePath = path.join(currentDir, item.name);
          const relPath = path.relative(rootDir, filePath);
          folderStructure.push(relPath);

          // If the file is in root and is a manifest, read it
          const isRootFile = path.dirname(filePath) === rootDir;
          const manifestNames = ['package.json', 'requirements.txt', 'pom.xml', 'build.gradle', 'Cargo.toml'];
          if (isRootFile && manifestNames.includes(item.name)) {
            try {
              manifests[item.name] = fs.readFileSync(filePath, 'utf8');
            } catch (e) {}
          }
        }
      }
    } catch (e) {}
  }
}
