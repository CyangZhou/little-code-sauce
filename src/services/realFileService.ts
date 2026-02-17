export interface VirtualFile {
  path: string;
  content: string;
  type: 'file';
  lastModified: number;
}

export interface ProjectWorkspace {
  id: string;
  name: string;
  rootPath: string;
  files: Map<string, VirtualFile>;
  directories: Set<string>;
  createdAt: number;
  updatedAt: number;
}

export interface FileChangeEvent {
  type: 'create' | 'update' | 'delete';
  path: string;
  content?: string;
}

type FileChangeListener = (event: FileChangeEvent) => void;

const WORKSPACE_STORAGE_KEY = 'lcs-workspace';

class RealFileService {
  private workspace: ProjectWorkspace | null = null;
  private listeners: Set<FileChangeListener> = new Set();
  private directoryHandle: FileSystemDirectoryHandle | null = null;

  constructor() {
    this.loadWorkspace();
  }

  private loadWorkspace() {
    try {
      const saved = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        const workspace: ProjectWorkspace = {
          ...data,
          files: new Map(Object.entries(data.files || {})),
          directories: new Set<string>(Array.isArray(data.directories) ? data.directories : []),
        };
        this.workspace = workspace;
        if (workspace.directories.size === 0) {
          workspace.files.forEach((_, path) => {
            const parts = path.split('/').slice(0, -1);
            if (parts.length > 0) {
              this.addDirectoryPath(parts.join('/'));
            }
          });
        }
      }
    } catch (e) {
      console.error('Failed to load workspace:', e);
    }
  }

  private saveWorkspace() {
    if (!this.workspace) return;
    
    try {
      const data = {
        ...this.workspace,
        files: Object.fromEntries(this.workspace.files),
        directories: Array.from(this.workspace.directories),
      };
      localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save workspace:', e);
    }
  }

  private notifyListeners(event: FileChangeEvent) {
    this.listeners.forEach(listener => listener(event));
  }

  addListener(listener: FileChangeListener) {
    this.listeners.add(listener);
  }

  removeListener(listener: FileChangeListener) {
    this.listeners.delete(listener);
  }

  hasWorkspace(): boolean {
    return this.workspace !== null;
  }

  getWorkspace(): ProjectWorkspace | null {
    return this.workspace;
  }

  async requestDirectoryAccess(): Promise<boolean> {
    if (!('showDirectoryPicker' in window)) {
      console.warn('File System Access API not supported');
      return false;
    }

    try {
      this.directoryHandle = await (window as Window & { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
      
      this.workspace = {
        id: `workspace-${Date.now()}`,
        name: this.directoryHandle.name,
        rootPath: '/',
        files: new Map(),
        directories: new Set(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await this.loadDirectoryContents(this.directoryHandle, '');
      this.saveWorkspace();
      
      return true;
    } catch (e) {
      console.error('Failed to get directory access:', e);
      return false;
    }
  }

  private async loadDirectoryContents(dirHandle: FileSystemDirectoryHandle, basePath: string): Promise<void> {
    if (!this.workspace) return;

    try {
      const entries: [string, FileSystemHandle][] = [];
      for await (const [name, entry] of (dirHandle as unknown as Iterable<[string, FileSystemHandle]>)) {
        entries.push([name, entry]);
      }
      
      for (const [, entry] of entries) {
        const path = basePath ? `${basePath}/${entry.name}` : entry.name;
        
        if (entry.kind === 'file') {
          try {
            const fileHandle = entry as FileSystemFileHandle;
            const file = await fileHandle.getFile();
            const content = await file.text();
            
            this.workspace.files.set(path, {
              path,
              content,
              type: 'file',
              lastModified: file.lastModified,
            });
          } catch (e) {
            console.warn(`Failed to read file ${path}:`, e);
          }
        } else if (entry.kind === 'directory') {
          this.addDirectoryPath(path);
          await this.loadDirectoryContents(entry as FileSystemDirectoryHandle, path);
        }
      }
    } catch (e) {
      console.error('Error loading directory contents:', e);
    }
  }

  createWorkspace(name: string): ProjectWorkspace {
    const workspace: ProjectWorkspace = {
      id: `workspace-${Date.now()}`,
      name,
      rootPath: '/',
      files: new Map(),
      directories: new Set(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    workspace.files.set('README.md', {
      path: 'README.md',
      content: `# ${name}\n\n这是一个由小码酱创建的项目。\n\n## 开始\n\n使用小码酱来编写代码！\n`,
      type: 'file',
      lastModified: Date.now(),
    });

    workspace.files.set('package.json', {
      path: 'package.json',
      content: JSON.stringify({
        name: name.toLowerCase().replace(/\s+/g, '-'),
        version: '1.0.0',
        description: `${name} - 由小码酱创建`,
        scripts: {
          dev: 'echo "请配置开发脚本"',
          build: 'echo "请配置构建脚本"',
        },
      }, null, 2),
      type: 'file',
      lastModified: Date.now(),
    });

    this.workspace = workspace;
    this.saveWorkspace();
    
    return workspace;
  }

  async refreshFromDirectory(): Promise<boolean> {
    if (!this.directoryHandle) {
      return this.requestDirectoryAccess();
    }

    try {
      this.workspace!.files.clear();
      await this.loadDirectoryContents(this.directoryHandle, '');
      this.workspace!.updatedAt = Date.now();
      this.saveWorkspace();
      return true;
    } catch (e) {
      console.error('Failed to refresh directory:', e);
      return false;
    }
  }

  closeWorkspace() {
    this.workspace = null;
    this.directoryHandle = null;
    localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  }

  listFiles(): VirtualFile[] {
    if (!this.workspace) return [];
    return Array.from(this.workspace.files.values());
  }

  listDirectories(): string[] {
    if (!this.workspace) return [];
    
    const dirs = new Set<string>(this.workspace.directories);
    this.workspace.files.forEach((_, path) => {
      const parts = path.split('/');
      for (let i = 1; i < parts.length; i++) {
        dirs.add(parts.slice(0, i).join('/'));
      }
    });
    
    return Array.from(dirs);
  }

  readFile(path: string): string | null {
    if (!this.workspace) return null;
    
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    const file = this.workspace.files.get(normalizedPath);
    return file?.content || null;
  }

  writeFile(path: string, content: string): boolean {
    if (!this.workspace) {
      this.createWorkspace('新项目');
    }

    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    const existed = this.workspace!.files.has(normalizedPath);

    const dirParts = normalizedPath.split('/').slice(0, -1);
    if (dirParts.length > 0) {
      this.addDirectoryPath(dirParts.join('/'));
    }
    
    this.workspace!.files.set(normalizedPath, {
      path: normalizedPath,
      content,
      type: 'file',
      lastModified: Date.now(),
    });
    
    this.workspace!.updatedAt = Date.now();
    this.saveWorkspace();
    
    this.notifyListeners({
      type: existed ? 'update' : 'create',
      path: normalizedPath,
      content,
    });

    if (this.directoryHandle) {
      this.writeToRealFile(normalizedPath, content);
    }

    return true;
  }

  private async writeToRealFile(path: string, content: string): Promise<boolean> {
    if (!this.directoryHandle) return false;

    try {
      const parts = path.split('/');
      const fileName = parts.pop()!;
      
      let currentDir = this.directoryHandle;
      
      for (const part of parts) {
        currentDir = await currentDir.getDirectoryHandle(part, { create: true });
      }
      
      const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      
      return true;
    } catch (e) {
      console.error('Failed to write to real file:', e);
      return false;
    }
  }

  deleteFile(path: string): boolean {
    if (!this.workspace) return false;

    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    
    if (!this.workspace.files.has(normalizedPath)) {
      return false;
    }

    this.workspace.files.delete(normalizedPath);
    this.workspace.updatedAt = Date.now();
    this.saveWorkspace();
    
    this.notifyListeners({
      type: 'delete',
      path: normalizedPath,
    });

    return true;
  }

  createDirectory(path: string): boolean {
    if (!this.workspace) return false;
    
    const normalizedPath = this.normalizePath(path);
    if (!normalizedPath) return false;
    if (this.workspace.files.has(normalizedPath)) return false;
    if (this.workspace.directories.has(normalizedPath)) return false;

    this.addDirectoryPath(normalizedPath);
    this.workspace.updatedAt = Date.now();
    this.saveWorkspace();

    this.notifyListeners({
      type: 'create',
      path: normalizedPath,
    });

    if (this.directoryHandle) {
      this.createRealDirectory(normalizedPath);
    }
    
    return true;
  }

  fileExists(path: string): boolean {
    if (!this.workspace) return false;
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    return this.workspace.files.has(normalizedPath);
  }

  searchFiles(query: string): VirtualFile[] {
    if (!this.workspace) return [];
    
    const lowerQuery = query.toLowerCase();
    return Array.from(this.workspace.files.values()).filter(file => 
      file.path.toLowerCase().includes(lowerQuery) ||
      file.content.toLowerCase().includes(lowerQuery)
    );
  }

  searchInFiles(query: string): { path: string; line: number; content: string }[] {
    if (!this.workspace) return [];
    
    const results: { path: string; line: number; content: string }[] = [];
    const lowerQuery = query.toLowerCase();
    
    this.workspace.files.forEach((file) => {
      const lines = file.content.split('\n');
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes(lowerQuery)) {
          results.push({
            path: file.path,
            line: idx + 1,
            content: line.trim(),
          });
        }
      });
    });
    
    return results.slice(0, 100);
  }

  exportWorkspace(): string {
    if (!this.workspace) return '{}';
    
    const exportData = {
      name: this.workspace.name,
      files: Object.fromEntries(this.workspace.files),
      directories: Array.from(this.workspace.directories),
      exportedAt: new Date().toISOString(),
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  importWorkspace(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      
      if (!data.name || !data.files) {
        throw new Error('Invalid workspace data');
      }

      this.workspace = {
        id: `workspace-${Date.now()}`,
        name: data.name,
        rootPath: '/',
        files: new Map(Object.entries(data.files)),
        directories: new Set<string>(Array.isArray(data.directories) ? data.directories : []),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      if (this.workspace.directories.size === 0) {
        this.workspace.files.forEach((_, path) => {
          const parts = path.split('/').slice(0, -1);
          if (parts.length > 0) {
            this.addDirectoryPath(parts.join('/'));
          }
        });
      }
      
      this.saveWorkspace();
      return true;
    } catch (e) {
      console.error('Failed to import workspace:', e);
      return false;
    }
  }

  downloadWorkspace() {
    if (!this.workspace) return;

    const files = Array.from(this.workspace.files.entries());
    
    if (files.length === 1) {
      const [path, file] = files[0];
      const blob = new Blob([file.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = path.split('/').pop() || 'file';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const allContent = files.map(([path, file]) => 
        `=== ${path} ===\n${file.content}\n`
      ).join('\n');
      
      const blob = new Blob([allContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.workspace.name}-export.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  getFileTree(): { name: string; path: string; type: 'file' | 'directory' }[] {
    if (!this.workspace) return [];

    const result: { name: string; path: string; type: 'file' | 'directory' }[] = [];
    const dirs = new Set<string>(this.workspace.directories);

    this.workspace.files.forEach((file) => {
      const parts = file.path.split('/');
      
      for (let i = 0; i < parts.length - 1; i++) {
        const dirPath = parts.slice(0, i + 1).join('/');
        if (!dirs.has(dirPath)) {
          dirs.add(dirPath);
        }
      }
      
      result.push({
        name: parts[parts.length - 1],
        path: file.path,
        type: 'file',
      });
    });

    Array.from(dirs).forEach((dirPath) => {
      const name = dirPath.split('/').pop() || dirPath;
      result.push({
        name,
        path: dirPath,
        type: 'directory',
      });
    });

    return result;
  }

  private normalizePath(path: string): string {
    const trimmed = path.trim().replace(/\\/g, '/');
    if (!trimmed) return '';
    const normalized = trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
    return normalized;
  }

  private addDirectoryPath(path: string) {
    if (!this.workspace) return;
    const normalizedPath = this.normalizePath(path);
    if (!normalizedPath) return;
    const parts = normalizedPath.split('/');
    for (let i = 0; i < parts.length; i++) {
      const dirPath = parts.slice(0, i + 1).join('/');
      this.workspace.directories.add(dirPath);
    }
  }

  private async createRealDirectory(path: string): Promise<boolean> {
    if (!this.directoryHandle) return false;
    const parts = this.normalizePath(path).split('/').filter(Boolean);
    if (parts.length === 0) return false;
    try {
      let currentDir = this.directoryHandle;
      for (const part of parts) {
        currentDir = await currentDir.getDirectoryHandle(part, { create: true });
      }
      return true;
    } catch (e) {
      console.error('Failed to create real directory:', e);
      return false;
    }
  }
}

export const realFileService = new RealFileService();
