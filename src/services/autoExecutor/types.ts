export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      items?: { type: string };
    }>;
    required?: string[];
  };
}

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

export interface ExecutionStep {
  id: string;
  type: 'think' | 'tool_call' | 'tool_result' | 'message';
  content: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  timestamp: number;
}

export interface ExecutionPlan {
  goal: string;
  steps: ExecutionStep[];
  status: 'planning' | 'executing' | 'completed' | 'failed';
  currentStep: number;
}

export interface ExecutorConfig {
  maxIterations: number;
  timeout: number;
  autoConfirmDestructive: boolean;
  enableReflection: boolean;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  trigger: string[];
  steps: WorkflowStep[];
  category: 'code' | 'web' | 'data' | 'general';
}

export interface WorkflowStep {
  action: string;
  params?: Record<string, unknown>;
  condition?: string;
}

export const BUILTIN_TOOLS: ToolDefinition[] = [
  {
    name: 'read_file',
    description: '读取文件内容。支持读取代码、配置文件、文档等。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件路径，可以是相对路径或绝对路径',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: '创建或覆盖写入文件。会自动创建不存在的目录。',
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
    description: '编辑文件，替换指定内容。适合精确修改代码片段。',
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
    description: '删除文件或目录。⚠️ 破坏性操作，需要确认。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '要删除的文件或目录路径',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_directory',
    description: '列出目录内容，返回文件和子目录列表。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '目录路径，默认为当前工作目录',
        },
        recursive: {
          type: 'boolean',
          description: '是否递归列出子目录',
        },
      },
      required: [],
    },
  },
  {
    name: 'execute_command',
    description: '执行Shell命令。支持npm、git、构建工具等。',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: '要执行的命令',
        },
        cwd: {
          type: 'string',
          description: '工作目录，默认为项目根目录',
        },
        timeout: {
          type: 'number',
          description: '超时时间（毫秒），默认30000',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'search_code',
    description: '在代码库中搜索内容。支持正则表达式和文件过滤。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词或正则表达式',
        },
        path: {
          type: 'string',
          description: '搜索范围，默认为整个项目',
        },
        filePattern: {
          type: 'string',
          description: '文件过滤模式，如 *.ts, *.py',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_search',
    description: '搜索互联网获取最新信息。用于查询文档、解决方案等。',
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
    description: '获取网页内容。用于读取文档、API响应等。',
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
    name: 'create_directory',
    description: '创建目录。会自动创建所有不存在的父目录。',
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
    name: 'git_operation',
    description: '执行Git操作。支持status、commit、push、pull等。',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'Git操作类型',
          enum: ['status', 'add', 'commit', 'push', 'pull', 'branch', 'checkout', 'log', 'diff'],
        },
        args: {
          type: 'string',
          description: '额外参数，如commit message',
        },
      },
      required: ['operation'],
    },
  },
  {
    name: 'npm_operation',
    description: '执行npm/yarn/pnpm操作。支持install、run、build等。',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'npm操作类型',
          enum: ['install', 'run', 'build', 'test', 'dev', 'init'],
        },
        args: {
          type: 'string',
          description: '额外参数，如包名或脚本名',
        },
        packageManager: {
          type: 'string',
          description: '包管理器',
          enum: ['npm', 'yarn', 'pnpm'],
        },
      },
      required: ['operation'],
    },
  },
  {
    name: 'ask_user',
    description: '向用户提问以获取更多信息或确认。用于需要用户输入的场景。',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: '要问用户的问题',
        },
        options: {
          type: 'array',
          description: '可选的答案选项',
          items: { type: 'string' },
        },
      },
      required: ['question'],
    },
  },
  {
    name: 'complete',
    description: '标记任务完成。当目标达成时调用此工具。',
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
];

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'create-react-component',
    name: '创建React组件',
    description: '创建一个新的React组件，包含TypeScript类型和样式',
    trigger: ['创建组件', '新建组件', 'react component'],
    category: 'code',
    steps: [
      { action: 'ask_user', params: { question: '组件名称是什么？' } },
      { action: 'create_directory', params: { path: 'src/components/{name}' } },
      { action: 'write_file', params: { path: 'src/components/{name}/{name}.tsx' } },
      { action: 'write_file', params: { path: 'src/components/{name}/index.ts' } },
    ],
  },
  {
    id: 'init-project',
    name: '初始化项目',
    description: '初始化一个新的前端项目',
    trigger: ['初始化项目', '新建项目', 'init project'],
    category: 'code',
    steps: [
      { action: 'ask_user', params: { question: '项目名称？', options: ['my-app'] } },
      { action: 'execute_command', params: { command: 'npm create vite@latest {name} -- --template react-ts' } },
    ],
  },
  {
    id: 'fix-bug',
    name: '修复Bug',
    description: '分析并修复代码中的Bug',
    trigger: ['修复bug', 'fix bug', '调试错误'],
    category: 'code',
    steps: [
      { action: 'ask_user', params: { question: '请描述问题或错误信息' } },
      { action: 'search_code', params: {} },
      { action: 'read_file', params: {} },
      { action: 'edit_file', params: {} },
    ],
  },
  {
    id: 'add-feature',
    name: '添加功能',
    description: '为现有项目添加新功能',
    trigger: ['添加功能', '实现功能', 'add feature'],
    category: 'code',
    steps: [
      { action: 'ask_user', params: { question: '请描述要添加的功能' } },
      { action: 'search_code', params: {} },
      { action: 'read_file', params: {} },
      { action: 'write_file', params: {} },
    ],
  },
  {
    id: 'refactor-code',
    name: '重构代码',
    description: '重构现有代码以提高质量',
    trigger: ['重构代码', '优化代码', 'refactor'],
    category: 'code',
    steps: [
      { action: 'ask_user', params: { question: '要重构哪个文件或模块？' } },
      { action: 'read_file', params: {} },
      { action: 'edit_file', params: {} },
    ],
  },
  {
    id: 'search-documentation',
    name: '搜索文档',
    description: '搜索技术文档和解决方案',
    trigger: ['搜索文档', '查找文档', 'search docs'],
    category: 'general',
    steps: [
      { action: 'ask_user', params: { question: '要搜索什么？' } },
      { action: 'web_search', params: {} },
      { action: 'web_fetch', params: {} },
    ],
  },
];

export const DEFAULT_EXECUTOR_CONFIG: ExecutorConfig = {
  maxIterations: 20,
  timeout: 120000,
  autoConfirmDestructive: false,
  enableReflection: true,
};
