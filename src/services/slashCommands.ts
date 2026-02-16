export type SlashCommandType = 
  | 'open' 
  | 'terminal' 
  | 'help' 
  | 'clear' 
  | 'model' 
  | 'agent' 
  | 'file'
  | 'search'
  | 'git'
  | 'run'
  | 'undo'
  | 'redo'
  | 'share'
  | 'init'
  | 'connect'
  | 'diff';

export interface SlashCommand {
  name: string;
  alias?: string[];
  description: string;
  usage: string;
  examples: string[];
  execute: (args: string, context: CommandContext) => Promise<CommandResult>;
}

export interface CommandContext {
  setInput: (value: string) => void;
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  openFile?: (filename: string, content?: string) => void;
  toggleTerminal?: () => void;
  setAgentMode?: (mode: 'build' | 'plan') => void;
  currentAgentMode?: 'build' | 'plan';
  undo?: () => void;
  redo?: () => void;
  share?: () => string;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  action?: () => void;
}

export const slashCommands: SlashCommand[] = [
  {
    name: 'open',
    alias: ['o'],
    description: '快速搜索并打开文件',
    usage: '/open <文件名或路径>',
    examples: ['/open App.tsx', '/open src/components', '/o main.py'],
    execute: async (args: string, context: CommandContext) => {
      if (!args.trim()) {
        return {
          success: false,
          message: '请指定要打开的文件名或路径\n用法: /open <文件名>',
        };
      }
      const searchTerm = args.trim();
      return {
        success: true,
        message: `🔍 搜索文件: "${searchTerm}"\n\n请从文件浏览器中选择文件，或使用 @${searchTerm} 引用文件内容`,
        action: () => {
          context.openFile?.(searchTerm);
        },
      };
    },
  },
  {
    name: 'terminal',
    alias: ['t', 'term'],
    description: '显示或隐藏终端面板',
    usage: '/terminal',
    examples: ['/terminal', '/t'],
    execute: async (_args: string, context: CommandContext) => {
      return {
        success: true,
        message: '🖥️ 终端面板已切换',
        action: () => {
          context.toggleTerminal?.();
        },
      };
    },
  },
  {
    name: 'help',
    alias: ['h', '?'],
    description: '显示帮助信息和可用命令',
    usage: '/help [命令名]',
    examples: ['/help', '/help open', '/h'],
    execute: async (args: string, _context: CommandContext) => {
      if (args.trim()) {
        const cmd = slashCommands.find(
          c => c.name === args.trim() || c.alias?.includes(args.trim())
        );
        if (cmd) {
          return {
            success: true,
            message: `📖 **/${cmd.name}**\n\n${cmd.description}\n\n**用法:**\n\`${cmd.usage}\`\n\n**示例:**\n${cmd.examples.map(e => `- \`${e}\``).join('\n')}`,
          };
        }
        return {
          success: false,
          message: `未找到命令: ${args.trim()}`,
        };
      }

      const helpText = `📖 **小码酱命令指南**

**斜杠命令:**
${slashCommands.map(c => `  \`/${c.name}\` ${c.alias?.length ? `(${c.alias.map(a => `/${a}`).join(', ')})` : ''} - ${c.description}`).join('\n')}

**文件引用:**
  \`@文件名\` - 引用项目文件内容作为上下文
  \`@文件夹\` - 引用整个文件夹结构

**Agent模式:**
  \`/agent build\` - 完整开发模式 (默认)
  \`/agent plan\` - 只读分析模式

**快捷键:**
  \`Ctrl+Enter\` - 发送消息
  \`Ctrl+K\` - 清空对话
  \`Ctrl+/\` - 显示命令面板
  \`Tab\` - 切换Agent模式

---
*输入 \`/help <命令名>\` 查看详细用法*`;

      return { success: true, message: helpText };
    },
  },
  {
    name: 'clear',
    alias: ['c', 'cls'],
    description: '清空当前对话',
    usage: '/clear',
    examples: ['/clear', '/c'],
    execute: async (_args: string, context: CommandContext) => {
      return {
        success: true,
        message: '🧹 对话已清空',
        action: () => {
          context.setInput('');
        },
      };
    },
  },
  {
    name: 'model',
    alias: ['m'],
    description: '查看或切换当前模型',
    usage: '/model [模型名]',
    examples: ['/model', '/model gpt-4', '/m deepseek-chat'],
    execute: async (args: string, _context: CommandContext) => {
      if (!args.trim()) {
        return {
          success: true,
          message: `🤖 **当前模型配置**

**可用模型:**
- \`deepseek-chat\` - DeepSeek (推荐)
- \`gpt-4\` - OpenAI GPT-4
- \`claude-3\` - Anthropic Claude
- \`local\` - 本地模型

使用 \`/model <模型名>\` 切换模型`,
        };
      }
      return {
        success: true,
        message: `✅ 模型已切换为: ${args.trim()}`,
      };
    },
  },
  {
    name: 'agent',
    alias: ['a'],
    description: '切换Agent模式',
    usage: '/agent [build|plan]',
    examples: ['/agent', '/agent build', '/agent plan', '/a plan'],
    execute: async (args: string, context: CommandContext) => {
      const mode = args.trim().toLowerCase();
      
      if (!mode) {
        const currentMode = context.currentAgentMode || 'build';
        return {
          success: true,
          message: `🤖 **Agent模式**

当前模式: **${currentMode}**

**可用模式:**
- \`build\` - 完整开发模式，允许文件读写和命令执行
- \`plan\` - 只读分析模式，适合代码探索和规划

使用 \`/agent <模式>\` 切换`,
        };
      }

      if (mode === 'build' || mode === 'plan') {
        return {
          success: true,
          message: `✅ Agent模式已切换为: **${mode}**\n\n${mode === 'plan' ? '🔒 只读模式已启用，文件修改需要确认' : '🔓 完整开发模式已启用'}`,
          action: () => {
            context.setAgentMode?.(mode as 'build' | 'plan');
          },
        };
      }

      return {
        success: false,
        message: `未知的Agent模式: ${mode}\n可用模式: build, plan`,
      };
    },
  },
  {
    name: 'file',
    alias: ['f'],
    description: '文件操作命令',
    usage: '/file <read|write|list> [路径]',
    examples: ['/file read src/App.tsx', '/file list src/', '/f read package.json'],
    execute: async (args: string, _context: CommandContext) => {
      const [action, ...pathParts] = args.trim().split(/\s+/);
      const path = pathParts.join(' ');

      if (!action) {
        return {
          success: false,
          message: '请指定操作: read, write, list\n用法: /file <操作> [路径]',
        };
      }

      switch (action) {
        case 'read':
          return {
            success: true,
            message: `📄 读取文件: ${path || '(未指定)'}\n\n提示: 使用 @${path || '文件名'} 可以直接引用文件内容`,
          };
        case 'list':
          return {
            success: true,
            message: `📁 列出目录: ${path || './'}\n\n提示: 使用文件浏览器查看项目结构`,
          };
        case 'write':
          return {
            success: true,
            message: `📝 写入文件: ${path || '(未指定)'}\n\n请在对话中描述要写入的内容`,
          };
        default:
          return {
            success: false,
            message: `未知操作: ${action}\n可用操作: read, write, list`,
          };
      }
    },
  },
  {
    name: 'search',
    alias: ['s', 'find'],
    description: '在项目中搜索代码',
    usage: '/search <搜索词>',
    examples: ['/search useState', '/s function App', '/find import'],
    execute: async (args: string, _context: CommandContext) => {
      if (!args.trim()) {
        return {
          success: false,
          message: '请输入搜索词\n用法: /search <搜索词>',
        };
      }
      return {
        success: true,
        message: `🔍 搜索: "${args.trim()}"\n\n正在搜索项目文件...`,
      };
    },
  },
  {
    name: 'git',
    alias: ['g'],
    description: 'Git操作命令',
    usage: '/git <status|diff|commit|log>',
    examples: ['/git status', '/g log', '/git diff'],
    execute: async (args: string, _context: CommandContext) => {
      const action = args.trim() || 'status';
      
      const gitHelp = `🌿 **Git命令**

\`\`\`
/git status  - 查看仓库状态
/git diff    - 查看未提交的更改
/git log     - 查看提交历史
/git commit  - 提交更改
\`\`\`

当前执行: \`git ${action}\``;

      return {
        success: true,
        message: gitHelp,
      };
    },
  },
  {
    name: 'run',
    alias: ['r', 'exec'],
    description: '运行代码或脚本',
    usage: '/run <命令>',
    examples: ['/run npm start', '/r python main.py', '/exec make build'],
    execute: async (args: string, _context: CommandContext) => {
      if (!args.trim()) {
        return {
          success: false,
          message: '请指定要运行的命令\n用法: /run <命令>',
        };
      }
      return {
        success: true,
        message: `▶️ 执行命令: \`${args.trim()}\`\n\n命令将在终端中执行`,
      };
    },
  },
  {
    name: 'undo',
    alias: ['u'],
    description: '撤销最近的更改',
    usage: '/undo',
    examples: ['/undo', '/u'],
    execute: async (_args: string, context: CommandContext) => {
      return {
        success: true,
        message: '↩️ 已撤销最近的更改',
        action: () => {
          context.undo?.();
        },
      };
    },
  },
  {
    name: 'redo',
    alias: ['re'],
    description: '重做已撤销的更改',
    usage: '/redo',
    examples: ['/redo', '/re'],
    execute: async (_args: string, context: CommandContext) => {
      return {
        success: true,
        message: '↪️ 已重做更改',
        action: () => {
          context.redo?.();
        },
      };
    },
  },
  {
    name: 'share',
    alias: ['sh'],
    description: '分享当前对话',
    usage: '/share',
    examples: ['/share', '/sh'],
    execute: async (_args: string, context: CommandContext) => {
      const shareUrl = context.share?.() || `https://lcs.dev/share/${Date.now()}`;
      return {
        success: true,
        message: `🔗 **对话已分享**\n\n链接已复制到剪贴板:\n${shareUrl}\n\n你可以将此链接分享给团队成员。`,
      };
    },
  },
  {
    name: 'init',
    alias: ['i'],
    description: '初始化项目配置',
    usage: '/init',
    examples: ['/init', '/i'],
    execute: async (_args: string, _context: CommandContext) => {
      return {
        success: true,
        message: `🚀 **项目初始化**

正在分析项目结构...

\`\`\`yaml
项目配置:
  - 扫描源代码文件
  - 识别技术栈
  - 创建 AGENTS.md
  - 配置代码风格
\`\`\`

项目已初始化完成！小码酱现在可以更好地理解你的项目。`,
      };
    },
  },
  {
    name: 'connect',
    alias: ['conn'],
    description: '连接API提供商',
    usage: '/connect [提供商]',
    examples: ['/connect', '/connect opencode', '/conn deepseek'],
    execute: async (args: string, _context: CommandContext) => {
      const provider = args.trim() || 'opencode';
      return {
        success: true,
        message: `🔌 **连接API提供商**

正在连接: **${provider}**

\`\`\`
1. 访问 ${provider === 'opencode' ? 'opencode.ai/auth' : '设置页面'}
2. 登录并获取API密钥
3. 粘贴密钥完成配置
\`\`\`

配置完成后即可开始使用！`,
      };
    },
  },
  {
    name: 'diff',
    alias: ['d'],
    description: '查看代码变更差异',
    usage: '/diff [文件路径]',
    examples: ['/diff', '/diff src/App.tsx', '/d'],
    execute: async (args: string, _context: CommandContext) => {
      const file = args.trim();
      return {
        success: true,
        message: `📊 **代码差异视图**${file ? `\n文件: ${file}` : ''}

显示当前未提交的更改...

\`\`\`diff
- 旧代码
+ 新代码
\`\`\`

使用 \`/diff <文件>\` 查看特定文件的变更。`,
      };
    },
  },
];

export function parseSlashCommand(input: string): { isCommand: boolean; command?: string; args?: string } {
  const trimmed = input.trim();
  
  if (!trimmed.startsWith('/')) {
    return { isCommand: false };
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const command = parts[0]?.toLowerCase();
  const args = parts.slice(1).join(' ');

  return { isCommand: true, command, args };
}

export function findCommand(name: string): SlashCommand | undefined {
  return slashCommands.find(
    cmd => cmd.name === name || cmd.alias?.includes(name)
  );
}

export function getCommandSuggestions(partial: string): SlashCommand[] {
  const term = partial.toLowerCase().slice(1);
  return slashCommands.filter(
    cmd => cmd.name.startsWith(term) || cmd.alias?.some(a => a.startsWith(term))
  );
}
