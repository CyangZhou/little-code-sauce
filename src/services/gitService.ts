export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
  conflicts: string[];
  clean: boolean;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: Date;
  files: string[];
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
  upstream?: string;
  lastCommit?: string;
}

export interface GitDiff {
  file: string;
  additions: number;
  deletions: number;
  hunks: Array<{
    header: string;
    lines: Array<{
      type: 'add' | 'remove' | 'context';
      content: string;
      oldLine?: number;
      newLine?: number;
    }>;
  }>;
}

export interface GitRemote {
  name: string;
  url: string;
  type: 'fetch' | 'push';
}

export interface GitLogOptions {
  limit?: number;
  skip?: number;
  branch?: string;
  author?: string;
  since?: Date;
  until?: Date;
  file?: string;
}

class GitService {
  private isGitRepo: boolean = false;
  private currentBranch: string = '';
  private remotes: GitRemote[] = [];

  async initialize(): Promise<boolean> {
    try {
      this.isGitRepo = await this.checkIsRepo();
      if (this.isGitRepo) {
        this.currentBranch = await this.getCurrentBranch();
        this.remotes = await this.getRemotes();
      }
      return this.isGitRepo;
    } catch {
      return false;
    }
  }

  private async checkIsRepo(): Promise<boolean> {
    return true;
  }

  private async getCurrentBranch(): Promise<string> {
    return 'main';
  }

  async getStatus(): Promise<GitStatus> {
    return {
      branch: this.currentBranch || 'main',
      ahead: 0,
      behind: 0,
      staged: [],
      modified: ['src/App.tsx'],
      untracked: ['src/new-file.ts'],
      conflicts: [],
      clean: false,
    };
  }

  async getBranches(): Promise<GitBranch[]> {
    return [
      { name: 'main', current: true, lastCommit: 'abc123' },
      { name: 'develop', current: false, lastCommit: 'def456' },
      { name: 'feature/new-feature', current: false, lastCommit: 'ghi789' },
    ];
  }

  async getRemotes(): Promise<GitRemote[]> {
    return [
      { name: 'origin', url: 'https://github.com/user/repo.git', type: 'fetch' },
      { name: 'origin', url: 'https://github.com/user/repo.git', type: 'push' },
    ];
  }

  async getLog(options?: GitLogOptions): Promise<GitCommit[]> {
    const limit = options?.limit || 20;
    const commits: GitCommit[] = [];

    for (let i = 0; i < limit; i++) {
      commits.push({
        hash: `commit${i.toString(16).padStart(40, '0')}`,
        shortHash: `commit${i.toString(16).padStart(7, '0')}`,
        message: i === 0 ? '最新提交' : `提交 #${i}`,
        author: '开发者',
        email: 'dev@example.com',
        date: new Date(Date.now() - i * 3600000),
        files: ['src/App.tsx'],
      });
    }

    return commits;
  }

  async getDiff(filePath?: string, _staged?: boolean): Promise<GitDiff[]> {
    const file = filePath || 'src/App.tsx';
    return [
      {
        file,
        additions: 5,
        deletions: 2,
        hunks: [
          {
            header: '@@ -1,5 +1,8 @@',
            lines: [
              { type: 'context', content: 'import React from "react";', oldLine: 1, newLine: 1 },
              { type: 'remove', content: 'const oldCode = "deprecated";', oldLine: 2 },
              { type: 'add', content: 'const newCode = "updated";', newLine: 2 },
              { type: 'add', content: 'const feature = "new";', newLine: 3 },
              { type: 'context', content: '', oldLine: 3, newLine: 4 },
              { type: 'context', content: 'function App() {', oldLine: 4, newLine: 5 },
              { type: 'add', content: '  // 新增功能', newLine: 6 },
              { type: 'context', content: '  return <div>Hello</div>;', oldLine: 5, newLine: 7 },
            ],
          },
        ],
      },
    ];
  }

  async stage(files: string[]): Promise<void> {
    console.log('Staging files:', files);
  }

  async unstage(files: string[]): Promise<void> {
    console.log('Unstaging files:', files);
  }

  async commit(message: string, files?: string[]): Promise<string> {
    console.log('Committing:', message, files);
    return `commit-${Date.now().toString(16)}`;
  }

  async push(branch?: string, remote?: string): Promise<void> {
    console.log('Pushing to:', remote || 'origin', branch || this.currentBranch);
  }

  async pull(branch?: string, remote?: string): Promise<void> {
    console.log('Pulling from:', remote || 'origin', branch || this.currentBranch);
  }

  async fetch(remote?: string): Promise<void> {
    console.log('Fetching from:', remote || 'origin');
  }

  async createBranch(name: string, fromBranch?: string): Promise<void> {
    console.log('Creating branch:', name, 'from:', fromBranch || this.currentBranch);
  }

  async checkout(branch: string): Promise<void> {
    console.log('Checking out:', branch);
    this.currentBranch = branch;
  }

  async merge(branch: string): Promise<void> {
    console.log('Merging:', branch, 'into', this.currentBranch);
  }

  async rebase(branch: string): Promise<void> {
    console.log('Rebasing onto:', branch);
  }

  async stash(message?: string): Promise<void> {
    console.log('Stashing changes:', message);
  }

  async stashPop(): Promise<void> {
    console.log('Popping stash');
  }

  async stashList(): Promise<Array<{ id: string; message: string; date: Date }>> {
    return [
      { id: 'stash@{0}', message: '临时保存', date: new Date() },
    ];
  }

  async revert(commitHash: string): Promise<void> {
    console.log('Reverting commit:', commitHash);
  }

  async reset(mode: 'soft' | 'mixed' | 'hard', commitHash?: string): Promise<void> {
    console.log('Resetting:', mode, commitHash || 'HEAD~1');
  }

  async cherryPick(commitHash: string): Promise<void> {
    console.log('Cherry-picking:', commitHash);
  }

  async blame(_filePath: string): Promise<Array<{
    line: number;
    content: string;
    commit: string;
    author: string;
    date: Date;
  }>> {
    return [
      { line: 1, content: 'import React from "react";', commit: 'abc123', author: '开发者', date: new Date() },
      { line: 2, content: '', commit: 'abc123', author: '开发者', date: new Date() },
      { line: 3, content: 'function App() {', commit: 'def456', author: '其他开发者', date: new Date() },
    ];
  }

  async show(commitHash: string): Promise<{
    commit: GitCommit;
    diff: GitDiff[];
  }> {
    return {
      commit: {
        hash: commitHash,
        shortHash: commitHash.slice(0, 7),
        message: '示例提交',
        author: '开发者',
        email: 'dev@example.com',
        date: new Date(),
        files: ['src/App.tsx'],
      },
      diff: await this.getDiff(),
    };
  }

  async init(): Promise<void> {
    console.log('Initializing git repository');
    this.isGitRepo = true;
    this.currentBranch = 'main';
  }

  async clone(url: string, directory?: string): Promise<void> {
    console.log('Cloning:', url, 'to', directory || '.');
  }

  getIsRepo(): boolean {
    return this.isGitRepo;
  }

  getCurrentBranchName(): string {
    return this.currentBranch;
  }

  async addRemote(name: string, url: string): Promise<void> {
    console.log('Adding remote:', name, url);
    this.remotes.push({ name, url, type: 'fetch' });
  }

  async removeRemote(name: string): Promise<void> {
    console.log('Removing remote:', name);
    this.remotes = this.remotes.filter(r => r.name !== name);
  }

  generateGitignore(template: string): string {
    const templates: Record<string, string[]> = {
      node: [
        'node_modules/',
        'dist/',
        '.env',
        '*.log',
        '.DS_Store',
      ],
      python: [
        '__pycache__/',
        '*.pyc',
        '.venv/',
        'venv/',
        '.env',
        '*.egg-info/',
      ],
      rust: [
        'target/',
        'Cargo.lock',
        '**/*.rs.bk',
      ],
    };

    const patterns = templates[template] || templates.node;
    return `# ${template} gitignore\n${patterns.join('\n')}\n`;
  }
}

export const gitService = new GitService();
