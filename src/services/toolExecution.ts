import { permissionService } from './permission';

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  requiresConfirmation?: boolean;
  toolId?: string;
  params?: Record<string, unknown>;
}

export interface FileOperation {
  type: 'read' | 'write' | 'edit' | 'delete';
  path: string;
  content?: string;
  oldContent?: string;
  newContent?: string;
}

export interface ShellCommand {
  command: string;
  args?: string[];
  cwd?: string;
  timeout?: number;
}

class ToolExecutionService {
  private confirmationCallback: ((toolId: string, params: Record<string, unknown>) => Promise<boolean>) | null = null;
  private virtualFS: Map<string, string> = new Map();

  constructor() {
    this.initVirtualFS();
  }

  private initVirtualFS() {
    this.virtualFS.set('/README.md', `# 小码酱 Code 项目\n\n这是一个由小码酱创建的项目。\n`);
    this.virtualFS.set('/package.json', JSON.stringify({
      name: 'little-code-sauce-project',
      version: '1.0.0',
      description: '小码酱项目',
    }, null, 2));
    this.virtualFS.set('/src/index.ts', `// 入口文件\nconsole.log('Hello from 小码酱!');\n`);
  }

  setConfirmationCallback(callback: (toolId: string, params: Record<string, unknown>) => Promise<boolean>) {
    this.confirmationCallback = callback;
  }

  private async checkPermission(toolId: string, params: Record<string, unknown>): Promise<boolean> {
    if (!permissionService.canExecute(toolId)) {
      return false;
    }

    if (permissionService.needsConfirmation(toolId)) {
      if (this.confirmationCallback) {
        return await this.confirmationCallback(toolId, params);
      }
      return false;
    }

    return true;
  }

  async executeRead(path: string): Promise<ToolResult> {
    const params = { path };
    const allowed = await this.checkPermission('read', params);
    
    if (!allowed) {
      return { success: false, error: '权限被拒绝或需要确认', toolId: 'read', params };
    }

    const normalizedPath = this.normalizePath(path);
    const content = this.virtualFS.get(normalizedPath);
    
    if (content === undefined) {
      return { success: false, error: `文件不存在: ${path}` };
    }

    return { success: true, output: content, toolId: 'read', params };
  }

  async executeWrite(path: string, content: string): Promise<ToolResult> {
    const params = { path, content };
    const allowed = await this.checkPermission('write', params);
    
    if (!allowed) {
      return { success: false, error: '权限被拒绝或需要确认', toolId: 'write', params };
    }

    const normalizedPath = this.normalizePath(path);
    this.virtualFS.set(normalizedPath, content);
    
    return { success: true, output: `文件已写入: ${path}`, toolId: 'write', params };
  }

  async executeEdit(path: string, oldContent: string, newContent: string): Promise<ToolResult> {
    const params = { path, oldContent, newContent };
    const allowed = await this.checkPermission('edit', params);
    
    if (!allowed) {
      return { success: false, error: '权限被拒绝或需要确认', toolId: 'edit', params };
    }

    const normalizedPath = this.normalizePath(path);
    const content = this.virtualFS.get(normalizedPath);
    
    if (content === undefined) {
      return { success: false, error: `文件不存在: ${path}` };
    }

    if (!content.includes(oldContent)) {
      return { success: false, error: '未找到要替换的内容' };
    }

    const newFileContent = content.replace(oldContent, newContent);
    this.virtualFS.set(normalizedPath, newFileContent);
    
    return { success: true, output: `文件已编辑: ${path}`, toolId: 'edit', params };
  }

  async executeDelete(path: string): Promise<ToolResult> {
    const params = { path };
    const allowed = await this.checkPermission('delete', params);
    
    if (!allowed) {
      return { success: false, error: '权限被拒绝或需要确认', toolId: 'delete', params };
    }

    const normalizedPath = this.normalizePath(path);
    
    if (!this.virtualFS.has(normalizedPath)) {
      return { success: false, error: `文件不存在: ${path}` };
    }

    this.virtualFS.delete(normalizedPath);
    return { success: true, output: `文件已删除: ${path}`, toolId: 'delete', params };
  }

  async executeBash(command: string, args: string[] = [], _cwd?: string): Promise<ToolResult> {
    const params = { command, args };
    const allowed = await this.checkPermission('bash', params);
    
    if (!allowed) {
      return { success: false, error: '权限被拒绝或需要确认', toolId: 'bash', params };
    }

    const fullCommand = `${command} ${args.join(' ')}`.trim();
    
    if (command === 'ls' || command === 'dir') {
      const files = Array.from(this.virtualFS.keys());
      return { success: true, output: files.join('\n'), toolId: 'bash', params };
    }
    
    if (command === 'cat') {
      const path = args[0];
      if (path) {
        const content = this.virtualFS.get(this.normalizePath(path));
        return { success: true, output: content || `文件不存在: ${path}`, toolId: 'bash', params };
      }
    }
    
    if (command === 'echo') {
      return { success: true, output: args.join(' '), toolId: 'bash', params };
    }
    
    if (command === 'pwd') {
      return { success: true, output: '/workspace', toolId: 'bash', params };
    }

    return { 
      success: true, 
      output: `[模拟执行] ${fullCommand}\n(沙箱模式 - 实际命令未执行)`, 
      toolId: 'bash', 
      params 
    };
  }

  async executeWebFetch(url: string): Promise<ToolResult> {
    const params = { url };
    const allowed = await this.checkPermission('webfetch', params);
    
    if (!allowed) {
      return { success: false, error: '权限被拒绝或需要确认', toolId: 'webfetch', params };
    }

    try {
      const response = await fetch(url);
      const content = await response.text();
      return { success: true, output: content.slice(0, 5000), toolId: 'webfetch', params };
    } catch (error) {
      return { success: false, error: `请求失败: ${error}`, toolId: 'webfetch', params };
    }
  }

  async executeWebSearch(query: string): Promise<ToolResult> {
    const params = { query };
    const allowed = await this.checkPermission('websearch', params);
    
    if (!allowed) {
      return { success: false, error: '权限被拒绝或需要确认', toolId: 'websearch', params };
    }

    return { 
      success: true, 
      output: `[模拟搜索] "${query}"\n(实际搜索需要配置搜索API)`, 
      toolId: 'websearch', 
      params 
    };
  }

  async executeCode(code: string, language: string = 'javascript'): Promise<ToolResult> {
    const params = { code, language };
    const allowed = await this.checkPermission('code_execute', params);
    
    if (!allowed) {
      return { success: false, error: '权限被拒绝或需要确认', toolId: 'code_execute', params };
    }

    if (language === 'javascript' || language === 'typescript') {
      try {
        const result = new Function(`
          "use strict";
          ${code}
        `)();
        return { success: true, output: String(result), toolId: 'code_execute', params };
      } catch (error) {
        return { success: false, error: `执行错误: ${error}`, toolId: 'code_execute', params };
      }
    }

    return { 
      success: true, 
      output: `[模拟执行] ${language} 代码\n(沙箱模式 - 仅支持 JavaScript 执行)`, 
      toolId: 'code_execute', 
      params 
    };
  }

  async executeGit(command: string, args: string[] = []): Promise<ToolResult> {
    const params = { command, args };
    const allowed = await this.checkPermission('git', params);
    
    if (!allowed) {
      return { success: false, error: '权限被拒绝或需要确认', toolId: 'git', params };
    }

    const fullCommand = `git ${command} ${args.join(' ')}`.trim();
    
    if (command === 'status') {
      return { success: true, output: 'On branch main\nnothing to commit, working tree clean', toolId: 'git', params };
    }
    
    if (command === 'log') {
      return { success: true, output: 'commit abc123 (HEAD -> main)\nAuthor: 小码酱\nDate: Today\n\n    Initial commit', toolId: 'git', params };
    }

    return { 
      success: true, 
      output: `[模拟执行] ${fullCommand}\n(沙箱模式 - Git 命令模拟)`, 
      toolId: 'git', 
      params 
    };
  }

  private normalizePath(path: string): string {
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    return path;
  }

  listFiles(): string[] {
    return Array.from(this.virtualFS.keys());
  }

  getFileContent(path: string): string | undefined {
    return this.virtualFS.get(this.normalizePath(path));
  }

  getVirtualFS(): Map<string, string> {
    return this.virtualFS;
  }
}

export const toolExecutionService = new ToolExecutionService();
