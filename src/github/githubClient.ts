export class GitHubClient {
  constructor(private readonly token: string) {}

  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'GitMind-VSCode-Extension'
    };

    if (options.body || options.method === 'POST' || options.method === 'PUT') {
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
      if (status === 401) {
        throw new Error('GITHUB_UNAUTHORIZED');
      }
      if (status === 403) {
        throw new Error('GITHUB_FORBIDDEN');
      }
      if (status === 404) {
        throw new Error('GITHUB_NOT_FOUND');
      }
      if (status === 422) {
        throw new Error('GITHUB_UNPROCESSABLE');
      }
      throw new Error(`GitHub API error: ${res.statusText}`);
    }

    if (res.status === 204) {
      return {} as T;
    }

    return await res.json() as T;
  }

  public async getAuthenticatedUser(): Promise<{ login: string; name: string }> {
    const data = await this.request<any>('https://api.github.com/user');
    return {
      login: data.login,
      name: data.name || data.login
    };
  }

  public async listRepos(): Promise<Array<{ name: string; fullName: string; url: string; private: boolean; createdAt: string; updatedAt: string }>> {
    try {
      const [oldestData, newestData] = await Promise.all([
        this.request<any[]>('https://api.github.com/user/repos?sort=created&direction=asc&per_page=100'),
        this.request<any[]>('https://api.github.com/user/repos?sort=updated&direction=desc&per_page=100')
      ]);

      const repoMap = new Map<string, { name: string; fullName: string; url: string; private: boolean; createdAt: string; updatedAt: string }>();

      const addRepos = (repos: any[]) => {
        if (Array.isArray(repos)) {
          repos.forEach(repo => {
            if (repo && repo.full_name) {
              repoMap.set(repo.full_name, {
                name: repo.name,
                fullName: repo.full_name,
                url: repo.html_url,
                private: repo.private,
                createdAt: repo.created_at,
                updatedAt: repo.updated_at
              });
            }
          });
        }
      };

      addRepos(oldestData);
      addRepos(newestData);

      return Array.from(repoMap.values());
    } catch (e) {
      // Fallback if parallel requests fail
      const data = await this.request<any[]>('https://api.github.com/user/repos?sort=updated&per_page=100');
      return data.map(repo => ({
        name: repo.name,
        fullName: repo.full_name,
        url: repo.html_url,
        private: repo.private,
        createdAt: repo.created_at,
        updatedAt: repo.updated_at
      }));
    }
  }

  public async createRepo(name: string, description: string, isPrivate: boolean): Promise<{ url: string; cloneUrl: string }> {
    const data = await this.request<any>('https://api.github.com/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        private: isPrivate,
        auto_init: true
      })
    });
    return {
      url: data.html_url,
      cloneUrl: data.clone_url
    };
  }

  public async createBranch(owner: string, repo: string, newBranch: string, fromBranch: string): Promise<void> {
    // Step 1: GET https://api.github.com/repos/{owner}/{repo}/git/refs/heads/{fromBranch}
    const refData = await this.request<any>(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${fromBranch}`
    );
    const sha = refData.object.sha;

    // Step 2: POST https://api.github.com/repos/{owner}/{repo}/git/refs
    await this.request<any>(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${newBranch}`,
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
  ): Promise<{ url: string; number: number }> {
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
      body: JSON.stringify({
        merge_method: "merge"
      })
    });
  }

  public async createIssue(owner: string, repo: string, title: string, body: string): Promise<{ url: string; number: number }> {
    const data = await this.request<any>(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        body
      })
    });
    return {
      url: data.html_url,
      number: data.number
    };
  }

  public async listIssues(owner: string, repo: string): Promise<Array<{ number: number; title: string; state: string; url: string }>> {
    const data = await this.request<any[]>(`https://api.github.com/repos/${owner}/${repo}/issues?state=open`);
    return data
      .filter(item => !item.pull_request)
      .map(issue => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        url: issue.html_url
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
      let sha: string | undefined;
      try {
        const fileData = await this.request<any>(
          `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`
        );
        sha = fileData.sha;
      } catch (e: any) {
        if (e.message !== 'GITHUB_NOT_FOUND') {
          throw e;
        }
      }

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
