import type {
  ToolDefinition,
  ToolCall,
  ToolResult,
} from './types';
import {
  BUILTIN_TOOLS,
} from './types';

type ToolHandler = (args: Record<string, unknown>) => Promise<{ success: boolean; output?: string; error?: string }>;

interface FileChangeEvent {
  type: 'create' | 'update' | 'delete';
  path: string;
  content?: string;
}

type FileChangeListener = (event: FileChangeEvent) => void;

class ToolExecutor {
  private handlers: Map<string, ToolHandler> = new Map();
  private virtualFS: Map<string, string> = new Map();
  private listeners: Set<FileChangeListener> = new Set();
  private projectRoot: string = '/project';
  private confirmCallback: ((message: string) => Promise<boolean>) | null = null;
  private commandExecutor: ((command: string, cwd?: string) => Promise<string>) | null = null;

  constructor() {
    this.initVirtualFS();
    this.registerBuiltinHandlers();
  }

  private initVirtualFS() {
    this.virtualFS.set(`${this.projectRoot}/package.json`, JSON.stringify({
      name: 'little-code-sauce-project',
      version: '1.0.0',
      description: '小码酱项目',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview',
      },
    }, null, 2));

    this.virtualFS.set(`${this.projectRoot}/src/index.ts`, `// 入口文件
import { createApp } from './app';

createApp();
console.log('Hello from 小码酱!');
`);

    this.virtualFS.set(`${this.projectRoot}/src/app.ts`, `// 应用核心
export function createApp() {
  console.log('App created!');
}
`);

    this.virtualFS.set(`${this.projectRoot}/README.md`, `# 小码酱项目

这是一个由小码酱创建的项目。

## 快速开始

\`\`\`bash
npm install
npm run dev
\`\`\`
`);
  }

  private registerBuiltinHandlers() {
    this.handlers.set('read_file', async (args) => {
      const path = this.resolvePath(args.path as string);
      const content = this.virtualFS.get(path);
      
      if (content === undefined) {
        return { success: false, error: `文件不存在: ${args.path}` };
      }
      
      return { success: true, output: content };
    });

    this.handlers.set('write_file', async (args) => {
      const path = this.resolvePath(args.path as string);
      const content = args.content as string;
      const existed = this.virtualFS.has(path);
      
      this.virtualFS.set(path, content);
      this.notifyListeners({
        type: existed ? 'update' : 'create',
        path,
        content,
      });
      
      return { success: true, output: `文件已写入: ${args.path} (${content.length} 字符)` };
    });

    this.handlers.set('edit_file', async (args) => {
      const path = this.resolvePath(args.path as string);
      const oldContent = args.oldContent as string;
      const newContent = args.newContent as string;
      
      const content = this.virtualFS.get(path);
      if (content === undefined) {
        return { success: false, error: `文件不存在: ${args.path}` };
      }
      
      if (!content.includes(oldContent)) {
        return { success: false, error: `未找到要替换的内容。可能内容已变化或格式不匹配。` };
      }
      
      const newFileContent = content.replace(oldContent, newContent);
      this.virtualFS.set(path, newFileContent);
      this.notifyListeners({
        type: 'update',
        path,
        content: newFileContent,
      });
      
      return { success: true, output: `文件已编辑: ${args.path}` };
    });

    this.handlers.set('delete_file', async (args) => {
      const path = this.resolvePath(args.path as string);
      
      if (this.confirmCallback) {
        const confirmed = await this.confirmCallback(`确定要删除 ${args.path} 吗？此操作不可撤销。`);
        if (!confirmed) {
          return { success: false, error: '用户取消操作' };
        }
      }
      
      if (!this.virtualFS.has(path)) {
        return { success: false, error: `文件不存在: ${args.path}` };
      }
      
      this.virtualFS.delete(path);
      this.notifyListeners({
        type: 'delete',
        path,
      });
      
      return { success: true, output: `文件已删除: ${args.path}` };
    });

    this.handlers.set('list_directory', async (args) => {
      const dirPath = this.resolvePath((args.path as string) || '.');
      const recursive = args.recursive as boolean;
      
      const files: string[] = [];
      
      this.virtualFS.forEach((_, path) => {
        if (path.startsWith(dirPath === this.projectRoot ? dirPath : dirPath + '/')) {
          const relative = path.slice(dirPath === this.projectRoot ? dirPath.length + 1 : dirPath.length + 1);
          if (recursive || !relative.includes('/')) {
            files.push(relative);
          }
        }
      });
      
      if (files.length === 0) {
        return { success: true, output: '目录为空' };
      }
      
      return { success: true, output: files.map(f => `📄 ${f}`).join('\n') };
    });

    this.handlers.set('create_directory', async (args) => {
      return { success: true, output: `目录已创建: ${args.path}` };
    });

    this.handlers.set('execute_command', async (args) => {
      const command = args.command as string;
      const cwd = args.cwd as string | undefined;
      
      if (this.commandExecutor) {
        try {
          const output = await this.commandExecutor(command, cwd);
          return { success: true, output };
        } catch (error) {
          return { success: false, error: `命令执行失败: ${error}` };
        }
      }
      
      if (command.startsWith('npm') || command.startsWith('yarn') || command.startsWith('pnpm')) {
        return { 
          success: true, 
          output: `[模拟执行] ${command}\n✓ 命令已执行（沙箱模式）\n\n提示: 配置命令执行器后可执行真实命令` 
        };
      }
      
      if (command.startsWith('git')) {
        return { 
          success: true, 
          output: `[模拟执行] ${command}\n✓ Git 操作完成（沙箱模式）` 
        };
      }
      
      return { 
        success: true, 
        output: `[模拟执行] ${command}\n✓ 命令已执行（沙箱模式）` 
      };
    });

    this.handlers.set('search_code', async (args) => {
      const query = args.query as string;
      const filePattern = args.filePattern as string | undefined;
      const results: string[] = [];
      
      this.virtualFS.forEach((content, path) => {
        if (filePattern && !path.endsWith(filePattern.replace('*', ''))) {
          return;
        }
        
        if (content.toLowerCase().includes(query.toLowerCase())) {
          const lines = content.split('\n');
          const matches: string[] = [];
          
          lines.forEach((line, idx) => {
            if (line.toLowerCase().includes(query.toLowerCase())) {
              matches.push(`  L${idx + 1}: ${line.trim().slice(0, 80)}`);
            }
          });
          
          if (matches.length > 0) {
            results.push(`📄 ${path}\n${matches.slice(0, 5).join('\n')}`);
          }
        }
      });
      
      if (results.length === 0) {
        return { success: true, output: `未找到匹配 "${query}" 的内容` };
      }
      
      return { success: true, output: `找到 ${results.length} 个匹配:\n\n${results.join('\n\n')}` };
    });

    this.handlers.set('web_search', async (args) => {
      const query = args.query as string;
      return { 
        success: true, 
        output: `🔍 搜索: "${query}"\n\n[模拟搜索结果]\n配置搜索API后可获取真实结果。\n\n推荐:\n- 配置 SerpAPI\n- 配置 Brave Search API\n- 使用内置的 web_fetch 工具` 
      };
    });

    this.handlers.set('web_fetch', async (args) => {
      const url = args.url as string;
      try {
        const response = await fetch(url);
        const content = await response.text();
        return { success: true, output: content.slice(0, 5000) };
      } catch (error) {
        return { success: false, error: `请求失败: ${error}` };
      }
    });

    this.handlers.set('git_operation', async (args) => {
      const operation = args.operation as string;
      const extraArgs = args.args as string | undefined;
      
      const gitCommands: Record<string, string> = {
        status: 'git status',
        add: 'git add .',
        commit: `git commit -m "${extraArgs || 'Update'}"`,
        push: 'git push',
        pull: 'git pull',
        branch: 'git branch',
        checkout: `git checkout ${extraArgs || ''}`,
        log: 'git log --oneline -10',
        diff: 'git diff',
      };
      
      return { 
        success: true, 
        output: `[模拟执行] ${gitCommands[operation] || operation}\n✓ Git 操作完成` 
      };
    });

    this.handlers.set('npm_operation', async (args) => {
      const operation = args.operation as string;
      const extraArgs = args.args as string | undefined;
      const pm = (args.packageManager as string) || 'npm';
      
      const commands: Record<string, string> = {
        install: `${pm} install ${extraArgs || ''}`,
        run: `${pm} run ${extraArgs || ''}`,
        build: `${pm} run build`,
        test: `${pm} test`,
        dev: `${pm} run dev`,
        init: `${pm} init`,
      };
      
      return { 
        success: true, 
        output: `[模拟执行] ${commands[operation] || operation}\n✓ npm 操作完成` 
      };
    });

    this.handlers.set('ask_user', async (args) => {
      return { 
        success: true, 
        output: `❓ ${args.question}${args.options ? `\n选项: ${(args.options as string[]).join(', ')}` : ''}` 
      };
    });

    this.handlers.set('complete', async (args) => {
      const summary = args.summary as string;
      const files = args.files_changed as string[] | undefined;
      
      let output = `✅ 任务完成!\n\n${summary}`;
      if (files && files.length > 0) {
        output += `\n\n📝 修改的文件:\n${files.map(f => `  - ${f}`).join('\n')}`;
      }
      
      return { success: true, output };
    });
  }

  private resolvePath(path: string): string {
    if (path.startsWith('/')) {
      return path;
    }
    return `${this.projectRoot}/${path}`;
  }

  private notifyListeners(event: FileChangeEvent) {
    this.listeners.forEach(listener => listener(event));
  }

  setConfirmCallback(callback: (message: string) => Promise<boolean>) {
    this.confirmCallback = callback;
  }

  setCommandExecutor(executor: (command: string, cwd?: string) => Promise<string>) {
    this.commandExecutor = executor;
  }

  addFileChangeListener(listener: FileChangeListener) {
    this.listeners.add(listener);
  }

  removeFileChangeListener(listener: FileChangeListener) {
    this.listeners.delete(listener);
  }

  getTools(): ToolDefinition[] {
    return BUILTIN_TOOLS;
  }

  async execute(toolCall: ToolCall): Promise<ToolResult> {
    const handler = this.handlers.get(toolCall.name);
    
    if (!handler) {
      return {
        toolCallId: toolCall.id,
        name: toolCall.name,
        success: false,
        error: `未知工具: ${toolCall.name}`,
      };
    }
    
    const startTime = Date.now();
    
    try {
      const result = await handler(toolCall.arguments);
      
      return {
        toolCallId: toolCall.id,
        name: toolCall.name,
        success: result.success,
        output: result.output,
        error: result.error,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        toolCallId: toolCall.id,
        name: toolCall.name,
        success: false,
        error: `执行错误: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime,
      };
    }
  }

  getVirtualFS(): Map<string, string> {
    return this.virtualFS;
  }

  setProjectRoot(root: string) {
    this.projectRoot = root;
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }

  importFiles(files: Record<string, string>) {
    Object.entries(files).forEach(([path, content]) => {
      this.virtualFS.set(this.resolvePath(path), content);
    });
  }

  exportFiles(): Record<string, string> {
    const result: Record<string, string> = {};
    this.virtualFS.forEach((content, path) => {
      const relative = path.slice(this.projectRoot.length + 1);
      result[relative] = content;
    });
    return result;
  }
}

export const toolExecutor = new ToolExecutor();
