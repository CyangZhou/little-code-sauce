export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  content?: string;
}

export interface MCPPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
  capabilities: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
    logging?: boolean;
  };
}

export interface MCPConnectionStatus {
  connected: boolean;
  error?: string;
  lastPing?: number;
  serverInfo?: MCPServerInfo;
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface MCPServerConfig {
  name: string;
  displayName: string;
  description: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  icon?: string;
  autoStart?: boolean;
}

export interface MCPClientConfig {
  servers: MCPServerConfig[];
  defaultTimeout: number;
  retryAttempts: number;
}

export interface MCPMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

const BUILTIN_MCP_SERVERS: MCPServerConfig[] = [
  {
    name: 'filesystem',
    displayName: '文件系统',
    description: '读写本地文件系统，支持目录浏览和文件操作',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    icon: '📁',
    autoStart: true,
  },
  {
    name: 'github',
    displayName: 'GitHub',
    description: 'GitHub仓库操作，支持Issue、PR、搜索等',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    icon: '🐙',
    env: {
      GITHUB_TOKEN: '',
    },
  },
  {
    name: 'postgres',
    displayName: 'PostgreSQL',
    description: 'PostgreSQL数据库连接和查询',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    icon: '🐘',
    env: {
      POSTGRES_CONNECTION_STRING: '',
    },
  },
  {
    name: 'sqlite',
    displayName: 'SQLite',
    description: 'SQLite数据库操作',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', './data.db'],
    icon: '🗄️',
  },
  {
    name: 'fetch',
    displayName: 'HTTP Fetch',
    description: 'HTTP请求工具，支持GET/POST等',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
    icon: '🌐',
    autoStart: true,
  },
  {
    name: 'brave-search',
    displayName: 'Brave Search',
    description: 'Brave搜索引擎集成',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    icon: '🔍',
    env: {
      BRAVE_API_KEY: '',
    },
  },
  {
    name: 'puppeteer',
    displayName: 'Puppeteer',
    description: '浏览器自动化，支持截图、爬虫等',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    icon: '🎭',
  },
  {
    name: 'slack',
    displayName: 'Slack',
    description: 'Slack集成，支持消息发送和读取',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    icon: '💬',
    env: {
      SLACK_BOT_TOKEN: '',
    },
  },
  {
    name: 'memory',
    displayName: 'Memory',
    description: '持久化记忆存储',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    icon: '🧠',
    autoStart: true,
  },
  {
    name: 'sequential-thinking',
    displayName: 'Sequential Thinking',
    description: '结构化思维链推理',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    icon: '💭',
  },
];

class MCPService {
  private connections: Map<string, MCPConnectionStatus> = new Map();
  private tools: Map<string, MCPTool[]> = new Map();
  private resources: Map<string, MCPResource[]> = new Map();
  private prompts: Map<string, MCPPrompt[]> = new Map();
  private messageId = 0;
  private activeConnections: Map<string, WebSocket | null> = new Map();

  getBuiltinServers(): MCPServerConfig[] {
    return BUILTIN_MCP_SERVERS;
  }

  async connectServer(config: MCPServerConfig): Promise<MCPConnectionStatus> {
    try {
      console.log(`Connecting to MCP server: ${config.name}`);
      
      const serverInfo: MCPServerInfo = {
        name: config.name,
        version: '1.0.0',
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: true,
          resources: true,
          prompts: true,
          logging: true,
        },
      };

      const status: MCPConnectionStatus = {
        connected: true,
        lastPing: Date.now(),
        serverInfo,
      };

      this.connections.set(config.name, status);
      
      await this.discoverTools(config.name);
      await this.discoverResources(config.name);
      
      return status;
    } catch (error) {
      const status: MCPConnectionStatus = {
        connected: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
      this.connections.set(config.name, status);
      return status;
    }
  }

  async disconnectServer(serverName: string): Promise<void> {
    const ws = this.activeConnections.get(serverName);
    if (ws) {
      ws.close();
      this.activeConnections.delete(serverName);
    }
    this.connections.delete(serverName);
    this.tools.delete(serverName);
    this.resources.delete(serverName);
    this.prompts.delete(serverName);
  }

  private async discoverTools(serverName: string): Promise<void> {
    const builtinTools: Record<string, MCPTool[]> = {
      filesystem: [
        {
          name: 'read_file',
          description: '读取文件内容',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: '文件路径' },
            },
            required: ['path'],
          },
        },
        {
          name: 'write_file',
          description: '写入文件',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: '文件路径' },
              content: { type: 'string', description: '文件内容' },
            },
            required: ['path', 'content'],
          },
        },
        {
          name: 'list_directory',
          description: '列出目录内容',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: '目录路径' },
            },
            required: ['path'],
          },
        },
      ],
      github: [
        {
          name: 'search_repositories',
          description: '搜索GitHub仓库',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: '搜索关键词' },
            },
            required: ['query'],
          },
        },
        {
          name: 'create_issue',
          description: '创建Issue',
          inputSchema: {
            type: 'object',
            properties: {
              owner: { type: 'string', description: '仓库所有者' },
              repo: { type: 'string', description: '仓库名' },
              title: { type: 'string', description: 'Issue标题' },
              body: { type: 'string', description: 'Issue内容' },
            },
            required: ['owner', 'repo', 'title'],
          },
        },
      ],
      fetch: [
        {
          name: 'fetch_url',
          description: '获取URL内容',
          inputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string', description: '目标URL' },
              method: { type: 'string', description: 'HTTP方法', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
            },
            required: ['url'],
          },
        },
      ],
    };

    this.tools.set(serverName, builtinTools[serverName] || []);
  }

  private async discoverResources(serverName: string): Promise<void> {
    this.resources.set(serverName, []);
  }

  async callTool(serverName: string, call: MCPToolCall): Promise<MCPToolResult> {
    const status = this.connections.get(serverName);
    if (!status?.connected) {
      return {
        content: [{ type: 'text', text: `Server ${serverName} not connected` }],
        isError: true,
      };
    }

    console.log(`Calling tool ${call.name} on ${serverName}`, call.arguments);

    return {
      content: [
        {
          type: 'text',
          text: `Tool ${call.name} executed successfully on ${serverName}`,
        },
      ],
    };
  }

  async readResource(serverName: string, uri: string): Promise<MCPResource | null> {
    const status = this.connections.get(serverName);
    if (!status?.connected) return null;

    return {
      uri,
      name: uri.split('/').pop() || uri,
      content: `Resource content from ${serverName}: ${uri}`,
    };
  }

  getConnectionStatus(serverName: string): MCPConnectionStatus {
    return this.connections.get(serverName) || { connected: false };
  }

  getAllConnections(): Map<string, MCPConnectionStatus> {
    return this.connections;
  }

  getTools(serverName: string): MCPTool[] {
    return this.tools.get(serverName) || [];
  }

  getAllTools(): Map<string, MCPTool[]> {
    return this.tools;
  }

  getResources(serverName: string): MCPResource[] {
    return this.resources.get(serverName) || [];
  }

  getPrompts(serverName: string): MCPPrompt[] {
    return this.prompts.get(serverName) || [];
  }

  createMessage(method: string, params?: Record<string, unknown>): MCPMessage {
    return {
      jsonrpc: '2.0',
      id: ++this.messageId,
      method,
      params,
    };
  }

  generateClaudeConfig(servers: MCPServerConfig[]): string {
    const config = {
      mcpServers: {} as Record<string, object>,
    };

    servers.forEach((server) => {
      config.mcpServers[server.name] = {
        command: server.command,
        args: server.args,
        ...(server.env && { env: server.env }),
      };
    });

    return JSON.stringify(config, null, 2);
  }

  generateClaudeDesktopConfig(servers: MCPServerConfig[]): string {
    return this.generateClaudeConfig(servers);
  }

  generateVSCodeConfig(servers: MCPServerConfig[]): string {
    const config = {
      mcp: {
        servers: {} as Record<string, object>,
      },
    };

    servers.forEach((server) => {
      config.mcp.servers[server.name] = {
        command: server.command,
        args: server.args,
        ...(server.env && { env: server.env }),
      };
    });

    return JSON.stringify(config, null, 2);
  }

  exportConfig(): string {
    const config: MCPClientConfig = {
      servers: BUILTIN_MCP_SERVERS,
      defaultTimeout: 30000,
      retryAttempts: 3,
    };
    return JSON.stringify(config, null, 2);
  }

  importConfig(data: string): boolean {
    try {
      const config = JSON.parse(data) as MCPClientConfig;
      if (config.servers) {
        config.servers.forEach((server) => {
          this.connections.set(server.name, { connected: false });
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  getConnectedServers(): string[] {
    return Array.from(this.connections.entries())
      .filter(([, status]) => status.connected)
      .map(([name]) => name);
  }

  getAvailableTools(): Array<{ server: string; tool: MCPTool }> {
    const result: Array<{ server: string; tool: MCPTool }> = [];
    this.tools.forEach((tools, server) => {
      tools.forEach((tool) => {
        result.push({ server, tool });
      });
    });
    return result;
  }
}

export const mcpService = new MCPService();
export { BUILTIN_MCP_SERVERS };
