import { permissionService } from './permission';
import { realFileService } from './realFileService';

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

  constructor() {
    // No initialization needed for realFileService
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

    const content = realFileService.readFile(path);
    
    if (content === null) {
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

    realFileService.writeFile(path, content);
    
    return { success: true, output: `文件已写入: ${path}`, toolId: 'write', params };
  }

  async executeEdit(path: string, oldContent: string, newContent: string): Promise<ToolResult> {
    const params = { path, oldContent, newContent };
    const allowed = await this.checkPermission('edit', params);
    
    if (!allowed) {
      return { success: false, error: '权限被拒绝或需要确认', toolId: 'edit', params };
    }

    const content = realFileService.readFile(path);
    
    if (content === null) {
      return { success: false, error: `文件不存在: ${path}` };
    }

    // Simple string replace for now. In a real scenario, might need fuzzy match or patch.
    if (!content.includes(oldContent)) {
       // Try a more lenient check (e.g. trimming)
       if (!content.includes(oldContent.trim())) {
           return { success: false, error: '未找到要替换的内容 (请确保精确匹配)' };
       }
       // If trim matches, use replace on the trimmed version? No, that's risky.
       // Let's stick to strict replacement but maybe warn user.
       return { success: false, error: '未找到要替换的内容' };
    }

    const newFileContent = content.replace(oldContent, newContent);
    realFileService.writeFile(path, newFileContent);
    
    return { success: true, output: `文件已编辑: ${path}`, toolId: 'edit', params };
  }

  async executeDelete(path: string): Promise<ToolResult> {
    const params = { path };
    const allowed = await this.checkPermission('delete', params);
    
    if (!allowed) {
      return { success: false, error: '权限被拒绝或需要确认', toolId: 'delete', params };
    }

    const success = realFileService.deleteFile(path);
    
    if (!success) {
      return { success: false, error: `文件不存在或删除失败: ${path}` };
    }

    return { success: true, output: `文件已删除: ${path}`, toolId: 'delete', params };
  }

  async executeBash(command: string, args: string[] = [], cwd?: string): Promise<ToolResult> {
    void cwd;
    const params = { command, args };
    const allowed = await this.checkPermission('bash', params);
    
    if (!allowed) {
      return { success: false, error: '权限被拒绝或需要确认', toolId: 'bash', params };
    }

    // Map common bash commands to file service operations where possible
    if (command === 'ls' || command === 'dir') {
      const files = realFileService.listFiles();
      const output = files.map(f => f.path).join('\n');
      return { success: true, output: output || '(空目录)', toolId: 'bash', params };
    }
    
    if (command === 'cat') {
      const path = args[0];
      if (path) {
        const content = realFileService.readFile(path);
        return { success: true, output: content || `文件不存在: ${path}`, toolId: 'bash', params };
      }
    }
    
    if (command === 'mkdir') {
        // realFileService doesn't strictly distinguish dirs in flat map, but we can simulate
        return { success: true, output: `目录已创建 (模拟): ${args[0]}`, toolId: 'bash', params };
    }

    if (command === 'echo') {
      return { success: true, output: args.join(' '), toolId: 'bash', params };
    }
    
    if (command === 'pwd') {
      const ws = realFileService.getWorkspace();
      return { success: true, output: ws ? `/workspace/${ws.name}` : '/ (无工作区)', toolId: 'bash', params };
    }

    return { 
      success: true, 
      output: `[系统限制] 浏览器环境无法执行系统命令: ${command} ${args.join(' ')}\n请使用内置的文件操作命令或配置本地代理。`, 
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

    // In a real implementation, this would call a search API (Google/Bing/SerpApi)
    // Since we don't have one configured, we'll return a helpful message or use a free one if available.
    // For now, we'll assume no free search API is available directly from browser without CORS issues.
    return { success: false, error: 'Web search requires a backend proxy or API key (not configured)', toolId: 'websearch', params };
  }
}

export const toolExecutionService = new ToolExecutionService();
