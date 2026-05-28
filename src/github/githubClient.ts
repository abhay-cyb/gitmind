export class GitHubError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'GitHubError';
  }
}

export interface GitHubRepo {
  name: string;
  url: string;
  defaultBranch: string;
}

export interface GitHubPR {
  url: string;
  number: number;
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: string;
}

export interface GitHubUser {
  login: string;
  name: string;
}

export class GitHubClient {
  constructor(private readonly token: string) {}

  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'GitMind-VSCode-Extension'
    };

    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }

    const mergedOptions: RequestInit = {
      ...options,
      headers: {
        ...headers,
        ...(options.headers as Record<string, string> || {})
      }
    };

    const res = await fetch(url, mergedOptions);

    if (!res.ok) {
      const status = res.status;
      let errorText = '';
      try {
        const errJson = await res.json() as any;
        errorText = errJson?.message || '';
      } catch (e) {}

      // friendly mappings as required in Section 6
      if (status === 401) {
        throw new GitHubError(401, "GitHub token expired or invalid. Run 'GitMind: Connect GitHub Account' to reconnect.");
      }
      if (status === 403) {
        throw new GitHubError(403, "You don't have permission for this action on this repo.");
      }
      if (status === 404) {
        throw new GitHubError(404, "Repo or resource not found. Check the name and try again.");
      }
      if (status === 422) {
        throw new GitHubError(422, `GitHub rejected this action. ${errorText || 'The branch or PR may already exist.'}`);
      }

      throw new GitHubError(status, errorText || `GitHub API error: ${res.statusText}`);
    }

    if (res.status === 204) {
      return {} as T;
    }

    return await res.json() as T;
  }

  public async getAuthenticatedUser(): Promise<GitHubUser> {
    const data = await this.request<any>('https://api.github.com/user');
    return {
      login: data.login,
      name: data.name || data.login
    };
  }

  public async createRepo(name: string, description?: string, isPrivate: boolean = false): Promise<{ url: string; cloneUrl: string }> {
    const data = await this.request<any>('https://api.github.com/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description: description || '',
        private: isPrivate
      })
    });
    return {
      url: data.html_url,
      cloneUrl: data.clone_url
    };
  }

  public async listRepos(): Promise<GitHubRepo[]> {
    const data = await this.request<any[]>('https://api.github.com/user/repos?sort=updated&per_page=20');
    return data.map(repo => ({
      name: repo.name,
      url: repo.html_url,
      defaultBranch: repo.default_branch
    }));
  }

  public async createBranch(owner: string, repo: string, branchName: string, fromBranch: string): Promise<void> {
    // 1. Get SHA of base branch
    const refData = await this.request<any>(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${fromBranch}`
    );
    const sha = refData.object.sha;

    // 2. Create new reference
    await this.request<any>(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha
      })
    });
  }

  public async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string
  ): Promise<GitHubPR> {
    const data = await this.request<any>(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        body,
        head,
        base
      })
    });
    return {
      url: data.html_url,
      number: data.number
    };
  }

  public async mergePullRequest(owner: string, repo: string, prNumber: number): Promise<void> {
    await this.request<any>(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
      method: 'PUT',
      body: JSON.stringify({})
    });
  }

  public async createIssue(owner: string, repo: string, title: string, body?: string): Promise<{ url: string; number: number }> {
    const data = await this.request<any>(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        body: body || ''
      })
    });
    return {
      url: data.html_url,
      number: data.number
    };
  }

  public async listIssues(owner: string, repo: string): Promise<GitHubIssue[]> {
    const data = await this.request<any[]>(`https://api.github.com/repos/${owner}/${repo}/issues?state=open`);
    // Issues endpoint also returns pull requests, filter them out if html_url contains "/pull/"
    return data
      .filter(item => !item.pull_request)
      .map(issue => ({
        number: issue.number,
        title: issue.title,
        state: issue.state
      }));
  }

  public async pushFiles(
    owner: string,
    repo: string,
    branch: string,
    files: Array<{ path: string; content: string }>,
    commitMessage: string
  ): Promise<void> {
    for (const file of files) {
      // 1. Get SHA if file exists
      let sha: string | undefined;
      try {
        const fileData = await this.request<any>(
          `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`
        );
        sha = fileData.sha;
      } catch (e: any) {
        // 404 is expected if the file does not exist yet
        if (e.status !== 404) {
          throw e;
        }
      }

      // 2. Put file content
      const base64Content = Buffer.from(file.content, 'utf8').toString('base64');
      await this.request<any>(`https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`, {
        method: 'PUT',
        body: JSON.stringify({
          message: commitMessage,
          content: base64Content,
          branch,
          sha
        })
      });
    }
  }
}
