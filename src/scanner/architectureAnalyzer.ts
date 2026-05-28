import { CommitSummary } from '../git/log';

export interface ScanData {
  folderStructure: string[];
  manifests: { [filename: string]: string };
  readme?: string;
  dockerfile?: string;
  dockerCompose?: string;
  envKeys: string[];
  recentCommits: CommitSummary[];
  modifiedFiles: string[];
}

export class ArchitectureAnalyzer {
  public static analyze(data: ScanData): string {
    const projectType = this.detectProjectType(data);
    const techStack = this.detectTechStack(data);
    const modules = this.detectModules(data);
    const devGoal = this.inferDevGoal(data.recentCommits);
    const activeFiles = data.modifiedFiles.slice(0, 5).join(', ') || 'None';
    const timestamp = new Date().toISOString();

    return `---
Project Type: ${projectType}
Tech Stack: ${techStack.join(', ') || 'Unknown'}
Modules: ${modules.join(', ') || 'None detected'}
Recent Dev Goal: ${devGoal}
Last Active Files: ${activeFiles}
Last Scanned: ${timestamp}
---`;
  }

  private static detectProjectType(data: ScanData): string {
    if (data.manifests['package.json']) {
      try {
        const pkg = JSON.parse(data.manifests['package.json']);
        if (pkg.dependencies && pkg.dependencies['next']) {
          return 'Next.js Application';
        }
        if (pkg.dependencies && pkg.dependencies['react']) {
          return 'React Application';
        }
        if (pkg.dependencies && pkg.dependencies['express']) {
          return 'Node.js Express API';
        }
        return 'Node.js Application';
      } catch (e) {
        return 'Node.js Application';
      }
    }
    if (data.manifests['requirements.txt']) {
      return 'Python Application';
    }
    if (data.manifests['Cargo.toml']) {
      return 'Rust Project';
    }
    if (data.manifests['pom.xml'] || data.manifests['build.gradle']) {
      return 'Java Project';
    }
    
    // Fallback based on structure
    const paths = data.folderStructure.join('\n');
    if (paths.includes('.py')) { return 'Python Project'; }
    if (paths.includes('.rs')) { return 'Rust Project'; }
    if (paths.includes('.go')) { return 'Go Project'; }
    if (paths.includes('.ts') || paths.includes('.js')) { return 'JavaScript/TypeScript Project'; }

    return 'Generic Codebase';
  }

  private static detectTechStack(data: ScanData): string[] {
    const stack: string[] = [];

    // JavaScript / Node dependencies
    if (data.manifests['package.json']) {
      try {
        const pkg = JSON.parse(data.manifests['package.json']);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        const matches: { [key: string]: string } = {
          'next': 'Next.js',
          'react': 'React',
          'typescript': 'TypeScript',
          'tailwindcss': 'Tailwind CSS',
          'mongodb': 'MongoDB',
          'mongoose': 'Mongoose',
          'express': 'Express',
          'prisma': 'Prisma',
          'next-auth': 'NextAuth.js',
          '@auth/core': 'Auth.js',
          'stripe': 'Stripe',
          'firebase': 'Firebase',
          'redux': 'Redux',
          'vite': 'Vite',
          'nest': 'NestJS'
        };

        for (const [dep, name] of Object.entries(matches)) {
          if (deps[dep]) { stack.push(name); }
        }
      } catch (e) {}
    }

    // Python dependencies
    if (data.manifests['requirements.txt']) {
      const content = data.manifests['requirements.txt'];
      const matches: { [key: string]: string } = {
        'django': 'Django',
        'flask': 'Flask',
        'fastapi': 'FastAPI',
        'numpy': 'NumPy',
        'pandas': 'Pandas',
        'sqlalchemy': 'SQLAlchemy',
        'psycopg2': 'PostgreSQL client',
        'requests': 'Requests'
      };
      for (const [dep, name] of Object.entries(matches)) {
        if (new RegExp(`^${dep}`, 'mi').test(content)) {
          stack.push(name);
        }
      }
    }

    // Rust dependencies
    if (data.manifests['Cargo.toml']) {
      const content = data.manifests['Cargo.toml'];
      const matches: { [key: string]: string } = {
        'tokio': 'Tokio',
        'serde': 'Serde',
        'axum': 'Axum',
        'reqwest': 'Reqwest',
        'diesel': 'Diesel'
      };
      for (const [dep, name] of Object.entries(matches)) {
        if (new RegExp(`^${dep}\\s*=`, 'mi').test(content)) {
          stack.push(name);
        }
      }
    }

    // Docker detection
    if (data.dockerfile || data.dockerCompose) {
      stack.push('Docker');
    }

    return stack;
  }

  private static detectModules(data: ScanData): string[] {
    const modulesSet = new Set<string>();

    // Scan folder structure for common module directories
    // We look at the first two directories in the paths
    data.folderStructure.forEach(p => {
      const parts = p.split(/[\\\/]/);
      // Look in folders like src/xxx or modules/xxx or app/xxx
      if (parts.length > 1) {
        const top = parts[0].toLowerCase();
        if (top === 'src' || top === 'app' || top === 'lib' || top === 'modules') {
          const moduleName = parts[1];
          if (moduleName && !moduleName.includes('.') && moduleName !== 'node_modules') {
            modulesSet.add(moduleName);
          }
        } else if (top !== 'node_modules' && top !== '.git' && top !== '.gitmind' && !top.includes('.')) {
          modulesSet.add(parts[0]);
        }
      }
    });

    return Array.from(modulesSet).slice(0, 8);
  }

  private static inferDevGoal(commits: CommitSummary[]): string {
    if (commits.length === 0) {
      return 'Initial project development';
    }

    // Combine recent commit messages to match keywords
    const combinedMsg = commits.slice(0, 5).map(c => c.message.toLowerCase()).join(' ');

    if (combinedMsg.includes('auth') || combinedMsg.includes('login') || combinedMsg.includes('signup')) {
      return 'Authentication and user login features';
    }
    if (combinedMsg.includes('stripe') || combinedMsg.includes('pay') || combinedMsg.includes('billing')) {
      return 'Payment and subscription integration';
    }
    if (combinedMsg.includes('conflict') || combinedMsg.includes('merge') || combinedMsg.includes('branch')) {
      return 'Branch merging and conflict resolution';
    }
    if (combinedMsg.includes('docker') || combinedMsg.includes('deploy') || combinedMsg.includes('ci/cd')) {
      return 'Deployment and infrastructure setup';
    }
    if (combinedMsg.includes('fix') || combinedMsg.includes('bug') || combinedMsg.includes('issue')) {
      return 'Bug fixing and stabilization';
    }
    if (combinedMsg.includes('refactor') || combinedMsg.includes('clean')) {
      return 'Code refactoring and cleanup';
    }

    // Default to the latest commit message
    return commits[0].message;
  }
}
