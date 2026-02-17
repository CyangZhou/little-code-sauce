import { realFileService } from './realFileService';
import { permissionService } from './permission';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  success: boolean;
  output?: string;
  error?: string;
  duration?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface ExecutionOptions {
  requiresConfirmation?: boolean;
  dangerous?: boolean;
}

const BUILTIN_TOOLS: ToolDefinition[] = [
  {
    name: 'read_file',
    description: '读取工作区中的文件内容',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件路径',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: '创建或覆盖写入文件',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件路径',
        },
        content: {
          type: 'string',
          description: '文件内容',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: '编辑文件，替换指定内容',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件路径',
        },
        oldContent: {
          type: 'string',
          description: '要替换的原始内容',
        },
        newContent: {
          type: 'string',
          description: '替换后的新内容',
        },
      },
      required: ['path', 'oldContent', 'newContent'],
    },
  },
  {
    name: 'delete_file',
    description: '删除文件（危险操作）',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '要删除的文件路径',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_files',
    description: '列出工作区中的所有文件',
    parameters: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: '文件过滤模式（可选）',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_code',
    description: '在代码中搜索内容',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_directory',
    description: '创建目录',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '目录路径',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'web_search',
    description: '搜索互联网获取信息',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_fetch',
    description: '获取网页内容',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '目标URL',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'ask_user',
    description: '向用户提问获取更多信息',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: '要问的问题',
        },
      },
      required: ['question'],
    },
  },
  {
    name: 'complete',
    description: '标记任务完成',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: '任务完成摘要',
        },
        files_changed: {
          type: 'array',
          description: '修改的文件列表',
        },
      },
      required: ['summary'],
    },
  },
  {
    name: 'run_code',
    description: '在沙箱中运行JavaScript/TypeScript代码',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: '要执行的代码',
        },
        language: {
          type: 'string',
          description: '代码语言',
          enum: ['javascript', 'typescript'],
        },
      },
      required: ['code'],
    },
  },
];

type ToolHandler = (args: Record<string, unknown>) => Promise<{ success: boolean; output?: string; error?: string }>;

type ConfirmationCallback = (message: string, details?: string) => Promise<boolean>;
type UserInputCallback = (question: string) => Promise<string>;

class ToolExecutionService {
  private handlers: Map<string, ToolHandler> = new Map();
  private confirmationCallback: ConfirmationCallback | null = null;
  private userInputCallback: UserInputCallback | null = null;
  private filesChanged: string[] = [];

  constructor() {
    this.registerHandlers();
  }

  private registerHandlers() {
    this.handlers.set('read_file', async (args) => {
      const path = args.path as string;
      
      if (!realFileService.hasWorkspace()) {
        return { success: false, error: '没有打开的工作区。请先创建或打开一个项目。' };
      }

      const content = realFileService.readFile(path);
      
      if (content === null) {
        return { success: false, error: `文件不存在: ${path}` };
      }
      
      const lines = content.split('\n');
      const numberedContent = lines.map((line, idx) => `${(idx + 1).toString().padStart(4, ' ')}→${line}`).join('\n');
      
      return { 
        success: true, 
        output: `📄 ${path} (${lines.length} 行)\n\n${numberedContent}` 
      };
    });

    this.handlers.set('write_file', async (args) => {
      const path = args.path as string;
      const content = args.content as string;

      if (!realFileService.hasWorkspace()) {
        realFileService.createWorkspace('新项目');
      }

      const existed = realFileService.fileExists(path);
      
      if (existed && permissionService.needsConfirmation('write')) {
        if (this.confirmationCallback) {
          const confirmed = await this.confirmationCallback(
            `确认覆盖文件?`,
            `文件: ${path}\n新内容长度: ${content.length} 字符`
          );
          if (!confirmed) {
            return { success: false, error: '用户取消操作' };
          }
        }
      }

      const success = realFileService.writeFile(path, content);
      
      if (success) {
        this.filesChanged.push(path);
        return { success: true, output: `✅ 文件已${existed ? '更新' : '创建'}: ${path} (${content.length} 字符)` };
      }
      
      return { success: false, error: '写入文件失败' };
    });

    this.handlers.set('edit_file', async (args) => {
      const path = args.path as string;
      const oldContent = args.oldContent as string;
      const newContent = args.newContent as string;

      if (!realFileService.hasWorkspace()) {
        return { success: false, error: '没有打开的工作区' };
      }

      const content = realFileService.readFile(path);
      
      if (content === null) {
        return { success: false, error: `文件不存在: ${path}` };
      }

      if (!content.includes(oldContent)) {
        const similar = this.findSimilarContent(content, oldContent);
        if (similar) {
          return { 
            success: false, 
            error: `未找到要替换的内容。\n\n相似内容:\n${similar.slice(0, 200)}...` 
          };
        }
        return { success: false, error: '未找到要替换的内容' };
      }

      if (permissionService.needsConfirmation('edit')) {
        if (this.confirmationCallback) {
          const confirmed = await this.confirmationCallback(
            `确认编辑文件?`,
            `文件: ${path}\n替换: ${oldContent.slice(0, 50)}...\n为: ${newContent.slice(0, 50)}...`
          );
          if (!confirmed) {
            return { success: false, error: '用户取消操作' };
          }
        }
      }

      const newFileContent = content.replace(oldContent, newContent);
      const success = realFileService.writeFile(path, newFileContent);
      
      if (success) {
        this.filesChanged.push(path);
        return { success: true, output: `✅ 文件已编辑: ${path}` };
      }
      
      return { success: false, error: '编辑文件失败' };
    });

    this.handlers.set('delete_file', async (args) => {
      const path = args.path as string;

      if (!realFileService.hasWorkspace()) {
        return { success: false, error: '没有打开的工作区' };
      }

      if (!realFileService.fileExists(path)) {
        return { success: false, error: `文件不存在: ${path}` };
      }

      if (permissionService.needsConfirmation('delete')) {
        if (this.confirmationCallback) {
          const confirmed = await this.confirmationCallback(
            `⚠️ 确认删除文件?`,
            `文件: ${path}\n此操作不可撤销!`
          );
          if (!confirmed) {
            return { success: false, error: '用户取消操作' };
          }
        }
      }

      const success = realFileService.deleteFile(path);
      
      if (success) {
        this.filesChanged.push(`[删除] ${path}`);
        return { success: true, output: `✅ 文件已删除: ${path}` };
      }
      
      return { success: false, error: '删除文件失败' };
    });

    this.handlers.set('list_files', async (args) => {
      if (!realFileService.hasWorkspace()) {
        return { success: false, error: '没有打开的工作区' };
      }

      const filter = args.filter as string | undefined;
      let files = realFileService.listFiles();
      let directories = realFileService.listDirectories();
      
      if (filter) {
        const lowerFilter = filter.toLowerCase();
        files = files.filter(f => f.path.toLowerCase().includes(lowerFilter));
        directories = directories.filter(d => d.toLowerCase().includes(lowerFilter));
      }

      if (files.length === 0 && directories.length === 0) {
        return { success: true, output: '工作区为空' };
      }

      const dirOutput = directories.map(d => `📁 ${d}/`).join('\n');
      const fileOutput = files.map(f => {
        const size = f.content.length;
        const lines = f.content.split('\n').length;
        return `📄 ${f.path} (${lines} 行, ${size} 字节)`;
      }).join('\n');

      const sections = [
        directories.length > 0 ? `目录 (${directories.length} 个):\n${dirOutput}` : '',
        files.length > 0 ? `文件 (${files.length} 个):\n${fileOutput}` : '',
      ].filter(Boolean).join('\n\n');

      return { success: true, output: `📁 工作区内容:\n\n${sections}` };
    });

    this.handlers.set('search_code', async (args) => {
      if (!realFileService.hasWorkspace()) {
        return { success: false, error: '没有打开的工作区' };
      }

      const query = args.query as string;
      const results = realFileService.searchInFiles(query);

      if (results.length === 0) {
        return { success: true, output: `未找到匹配 "${query}" 的内容` };
      }

      const output = results.slice(0, 20).map(r => 
        `📄 ${r.path}:${r.line}\n   ${r.content}`
      ).join('\n\n');

      return { 
        success: true, 
        output: `🔍 搜索结果 "${query}" (${results.length} 个匹配):\n\n${output}${results.length > 20 ? `\n\n... 还有 ${results.length - 20} 个结果` : ''}` 
      };
    });

    this.handlers.set('create_directory', async (args) => {
      const path = args.path as string;

      if (!realFileService.hasWorkspace()) {
        realFileService.createWorkspace('新项目');
      }

      const created = realFileService.createDirectory(path);
      if (!created) {
        return { success: false, error: `创建目录失败或目录已存在: ${path}` };
      }
      return { success: true, output: `✅ 目录已创建: ${path}` };
    });

    this.handlers.set('web_search', async (args) => {
      const query = args.query as string;
      
      try {
        const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if (data.RelatedTopics && data.RelatedTopics.length > 0) {
          const results = data.RelatedTopics.slice(0, 5).map((topic: { Text?: string; FirstURL?: string }) => 
            `- ${topic.Text || '无描述'}\n  ${topic.FirstURL || ''}`
          ).join('\n\n');
          
          return { success: true, output: `🔍 搜索 "${query}":\n\n${results}` };
        }
        
        return { success: true, output: `搜索 "${query}" 未找到相关结果` };
      } catch (error) {
        void error;
        return { 
          success: true, 
          output: `🔍 搜索 "${query}"\n\n提示: 网络搜索需要配置API。建议:\n- 配置 SerpAPI\n- 配置 Brave Search API\n- 使用 web_fetch 工具获取特定网页` 
        };
      }
    });

    this.handlers.set('web_fetch', async (args) => {
      const url = args.url as string;
      
      try {
        const response = await fetch(url);
        const content = await response.text();
        
        const textContent = content
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 5000);
        
        return { success: true, output: `🌐 ${url}\n\n${textContent}` };
      } catch (e) {
        return { success: false, error: `获取网页失败: ${e}` };
      }
    });

    this.handlers.set('ask_user', async (args) => {
      const question = args.question as string;
      
      if (this.userInputCallback) {
        const answer = await this.userInputCallback(question);
        return { success: true, output: answer || '(用户未回答)' };
      }
      
      return { success: true, output: `❓ ${question}\n\n(需要用户输入回调)` };
    });

    this.handlers.set('complete', async (args) => {
      const summary = args.summary as string;
      const filesChanged = args.files_changed as string[] | undefined;
      
      let output = `✅ 任务完成!\n\n${summary}`;
      
      if (this.filesChanged.length > 0) {
        output += `\n\n📝 修改的文件:\n${this.filesChanged.map(f => `  - ${f}`).join('\n')}`;
      } else if (filesChanged && filesChanged.length > 0) {
        output += `\n\n📝 修改的文件:\n${filesChanged.map(f => `  - ${f}`).join('\n')}`;
      }
      
      this.filesChanged = [];
      
      return { success: true, output };
    });

    this.handlers.set('run_code', async (args) => {
      const code = args.code as string;
      const language = (args.language as string) || 'javascript';
      
      try {
        let result: unknown;
        
        if (language === 'typescript') {
          const transpiled = this.transpileTypeScript(code);
          result = this.executeJavaScript(transpiled);
        } else {
          result = this.executeJavaScript(code);
        }
        
        return { 
          success: true, 
          output: `▶️ 代码执行结果:\n\n${JSON.stringify(result, null, 2)}` 
        };
      } catch (e) {
        return { 
          success: false, 
          error: `代码执行错误: ${e instanceof Error ? e.message : String(e)}` 
        };
      }
    });
  }

  private findSimilarContent(content: string, target: string): string | null {
    const targetWords = target.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const lines = content.split('\n');
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      const matchCount = targetWords.filter(w => lowerLine.includes(w)).length;
      
      if (matchCount >= Math.ceil(targetWords.length * 0.5)) {
        return line;
      }
    }
    
    return null;
  }

  private transpileTypeScript(code: string): string {
    return code
      .replace(/:\s*(string|number|boolean|any|void|unknown|never)\s*(,|\)|=|\{|\[)/g, '$2')
      .replace(/:\s*(string|number|boolean|any|void|unknown|never)\s*$/gm, '')
      .replace(/<[^>]+>/g, '')
      .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
      .replace(/type\s+\w+\s*=\s*[^;]+;/g, '')
      .replace(/as\s+\w+/g, '');
  }

  private executeJavaScript(code: string): unknown {
    const consoleOutput: string[] = [];
    const mockConsole = {
      log: (...args: unknown[]) => consoleOutput.push(args.map(a => JSON.stringify(a)).join(' ')),
      error: (...args: unknown[]) => consoleOutput.push('[ERROR] ' + args.map(a => JSON.stringify(a)).join(' ')),
      warn: (...args: unknown[]) => consoleOutput.push('[WARN] ' + args.map(a => JSON.stringify(a)).join(' ')),
    };

    try {
      const fn = new Function('console', `"use strict";\n${code}\n`);
      const result = fn(mockConsole);
      
      if (consoleOutput.length > 0) {
        return { console: consoleOutput, result };
      }
      return result;
    } catch (e) {
      throw new Error(`执行错误: ${e}`);
    }
  }

  setConfirmationCallback(callback: ConfirmationCallback) {
    this.confirmationCallback = callback;
  }

  setUserInputCallback(callback: UserInputCallback) {
    this.userInputCallback = callback;
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

  getFilesChanged(): string[] {
    return [...this.filesChanged];
  }

  resetFilesChanged() {
    this.filesChanged = [];
  }
}

export const toolExecutionService = new ToolExecutionService();
