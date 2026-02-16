export type PermissionMode = 'allow' | 'deny' | 'ask';

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: 'file' | 'shell' | 'web' | 'mcp' | 'system';
  icon: string;
  dangerous: boolean;
  defaultPermission: PermissionMode;
}

export interface PermissionConfig {
  [toolId: string]: PermissionMode;
}

const BUILTIN_TOOLS: ToolDefinition[] = [
  {
    id: 'read',
    name: '读取文件',
    description: '读取项目中的文件内容',
    category: 'file',
    icon: '📄',
    dangerous: false,
    defaultPermission: 'allow',
  },
  {
    id: 'write',
    name: '写入文件',
    description: '创建或覆盖文件',
    category: 'file',
    icon: '✏️',
    dangerous: true,
    defaultPermission: 'ask',
  },
  {
    id: 'edit',
    name: '编辑文件',
    description: '通过精确匹配修改文件内容',
    category: 'file',
    icon: '🔧',
    dangerous: true,
    defaultPermission: 'ask',
  },
  {
    id: 'delete',
    name: '删除文件',
    description: '删除项目中的文件',
    category: 'file',
    icon: '🗑️',
    dangerous: true,
    defaultPermission: 'ask',
  },
  {
    id: 'bash',
    name: '执行命令',
    description: '在终端执行 Shell 命令',
    category: 'shell',
    icon: '⚡',
    dangerous: true,
    defaultPermission: 'ask',
  },
  {
    id: 'webfetch',
    name: '网页抓取',
    description: '获取网页内容',
    category: 'web',
    icon: '🌐',
    dangerous: false,
    defaultPermission: 'allow',
  },
  {
    id: 'websearch',
    name: '网络搜索',
    description: '搜索网络获取信息',
    category: 'web',
    icon: '🔍',
    dangerous: false,
    defaultPermission: 'allow',
  },
  {
    id: 'mcp_call',
    name: 'MCP 工具调用',
    description: '调用 MCP 服务器提供的工具',
    category: 'mcp',
    icon: '🔌',
    dangerous: true,
    defaultPermission: 'ask',
  },
  {
    id: 'code_execute',
    name: '代码执行',
    description: '在沙箱中执行代码',
    category: 'system',
    icon: '▶️',
    dangerous: true,
    defaultPermission: 'ask',
  },
  {
    id: 'git',
    name: 'Git 操作',
    description: '执行 Git 命令',
    category: 'shell',
    icon: '📦',
    dangerous: true,
    defaultPermission: 'ask',
  },
];

const STORAGE_KEY = 'lcs-permissions';

class PermissionService {
  private permissions: PermissionConfig = {};

  constructor() {
    this.loadPermissions();
  }

  private loadPermissions(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.permissions = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load permissions:', e);
    }
  }

  private savePermissions(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.permissions));
    } catch (e) {
      console.error('Failed to save permissions:', e);
    }
  }

  getTools(): ToolDefinition[] {
    return BUILTIN_TOOLS;
  }

  getPermission(toolId: string): PermissionMode {
    if (this.permissions[toolId]) {
      return this.permissions[toolId];
    }
    const tool = BUILTIN_TOOLS.find(t => t.id === toolId);
    return tool?.defaultPermission || 'ask';
  }

  setPermission(toolId: string, mode: PermissionMode): void {
    this.permissions[toolId] = mode;
    this.savePermissions();
  }

  setAllPermissions(mode: PermissionMode): void {
    BUILTIN_TOOLS.forEach(tool => {
      this.permissions[tool.id] = mode;
    });
    this.savePermissions();
  }

  resetPermissions(): void {
    this.permissions = {};
    this.savePermissions();
  }

  getAllPermissions(): PermissionConfig {
    const result: PermissionConfig = {};
    BUILTIN_TOOLS.forEach(tool => {
      result[tool.id] = this.getPermission(tool.id);
    });
    return result;
  }

  canExecute(toolId: string): boolean {
    const permission = this.getPermission(toolId);
    return permission !== 'deny';
  }

  needsConfirmation(toolId: string): boolean {
    const permission = this.getPermission(toolId);
    return permission === 'ask';
  }

  getToolsByCategory(): Record<string, ToolDefinition[]> {
    const result: Record<string, ToolDefinition[]> = {};
    BUILTIN_TOOLS.forEach(tool => {
      if (!result[tool.category]) {
        result[tool.category] = [];
      }
      result[tool.category].push(tool);
    });
    return result;
  }
}

export const permissionService = new PermissionService();
