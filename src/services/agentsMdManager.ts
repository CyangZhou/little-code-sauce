export interface AgentConfig {
  name: string;
  description: string;
  instructions: string;
  tools?: string[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ProjectContext {
  techStack: string[];
  conventions: string[];
  importantFiles: string[];
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
}

export interface AgentsMdConfig {
  version: string;
  project: {
    name: string;
    description: string;
    context: ProjectContext;
  };
  agents: AgentConfig[];
  rules: string[];
  preferences: Record<string, unknown>;
}

const DEFAULT_AGENTS_MD = `# AGENTS.md

## 项目信息
- 名称: 小码酱项目
- 描述: AI驱动的代码助手

## 技术栈
- 前端: React + TypeScript + Tailwind CSS
- 构建: Vite
- 状态管理: Zustand

## 编码规范
- 使用函数组件和 Hooks
- 遵循 TypeScript 严格模式
- 组件命名使用 PascalCase
- 文件命名使用 camelCase

## 重要文件
- src/App.tsx - 主应用入口
- src/store/useAppStore.ts - 全局状态
- src/services/ - 核心服务层

## Agent 配置

### 默认 Agent
- 名称: 小码酱
- 模式: build (完整开发模式)
- 能力: 代码生成、文件操作、命令执行

### Plan Agent
- 名称: 规划助手
- 模式: plan (只读分析模式)
- 能力: 代码分析、架构规划

## 工作流偏好
- 优先使用现有组件和工具
- 保持代码简洁可读
- 添加适当的错误处理
- 编写必要的注释

## 注意事项
- 不要修改核心配置文件
- 保持向后兼容性
- 测试关键功能
`;

export class AgentsMdManager {
  private config: AgentsMdConfig | null = null;

  async load(): Promise<AgentsMdConfig | null> {
    
    try {
      const stored = localStorage.getItem('lcs-agents-md');
      if (stored) {
        this.config = this.parseAgentsMd(stored);
        return this.config;
      }
    } catch {
      console.warn('Failed to load AGENTS.md from storage');
    }

    return null;
  }

  async initialize(projectName: string, description: string): Promise<AgentsMdConfig> {
    this.config = {
      version: '1.0.0',
      project: {
        name: projectName,
        description,
        context: {
          techStack: ['React', 'TypeScript', 'Tailwind CSS'],
          conventions: ['函数组件', 'TypeScript严格模式'],
          importantFiles: [],
          dependencies: {},
          scripts: {},
        },
      },
      agents: [
        {
          name: '小码酱',
          description: '默认开发助手',
          instructions: '你是一个专业的代码助手，帮助用户进行开发工作。',
          tools: ['read', 'write', 'edit', 'execute', 'search'],
          model: 'deepseek-chat',
          temperature: 0.7,
          maxTokens: 4096,
        },
        {
          name: '规划助手',
          description: '只读分析模式',
          instructions: '你是一个代码分析助手，帮助用户理解代码库和规划开发任务。',
          tools: ['read', 'search'],
          model: 'deepseek-chat',
          temperature: 0.5,
          maxTokens: 4096,
        },
      ],
      rules: [
        '保持代码简洁可读',
        '添加适当的错误处理',
        '遵循项目编码规范',
      ],
      preferences: {
        language: 'zh-CN',
        codeStyle: 'concise',
        autoSave: true,
      },
    };

    this.save();
    return this.config;
  }

  private parseAgentsMd(content: string): AgentsMdConfig {
    const lines = content.split('\n');
    const config: AgentsMdConfig = {
      version: '1.0.0',
      project: {
        name: '项目',
        description: '',
        context: {
          techStack: [],
          conventions: [],
          importantFiles: [],
          dependencies: {},
          scripts: {},
        },
      },
      agents: [],
      rules: [],
      preferences: {},
    };

    let currentSection = '';
    let currentAgent: AgentConfig | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('# ')) {
        currentSection = trimmed.slice(2).toLowerCase();
      } else if (trimmed.startsWith('## ')) {
        currentSection = trimmed.slice(3).toLowerCase();
        if (currentSection.includes('agent')) {
          currentAgent = {
            name: '',
            description: '',
            instructions: '',
          };
        }
      } else if (trimmed.startsWith('### ')) {
        if (currentAgent) {
          currentAgent.name = trimmed.slice(4);
        }
      } else if (trimmed.startsWith('- ')) {
        const value = trimmed.slice(2);
        
        if (currentSection.includes('技术栈') || currentSection.includes('tech')) {
          config.project.context.techStack.push(value);
        } else if (currentSection.includes('规范') || currentSection.includes('convention')) {
          config.project.context.conventions.push(value);
        } else if (currentSection.includes('重要文件') || currentSection.includes('important')) {
          config.project.context.importantFiles.push(value);
        } else if (currentSection.includes('规则') || currentSection.includes('rule')) {
          config.rules.push(value);
        } else if (currentAgent) {
          if (value.includes(':')) {
            const [key, val] = value.split(':').map(s => s.trim());
            switch (key.toLowerCase()) {
              case '名称':
              case 'name':
                currentAgent.name = val;
                break;
              case '模式':
              case 'mode':
                currentAgent.description = val;
                break;
              case '能力':
              case 'capabilities':
                currentAgent.tools = val.split(',').map(s => s.trim());
                break;
            }
          }
        }
      }
    }

    if (currentAgent && currentAgent.name) {
      config.agents.push(currentAgent);
    }

    return config;
  }

  save(): void {
    if (!this.config) return;

    const content = this.generateAgentsMd();
    localStorage.setItem('lcs-agents-md', content);
  }

  private generateAgentsMd(): string {
    if (!this.config) return DEFAULT_AGENTS_MD;

    const lines: string[] = [
      '# AGENTS.md',
      '',
      '## 项目信息',
      `- 名称: ${this.config.project.name}`,
      `- 描述: ${this.config.project.description}`,
      '',
      '## 技术栈',
    ];

    this.config.project.context.techStack.forEach((tech) => {
      lines.push(`- ${tech}`);
    });

    lines.push('', '## 编码规范');
    this.config.project.context.conventions.forEach((conv) => {
      lines.push(`- ${conv}`);
    });

    lines.push('', '## 重要文件');
    this.config.project.context.importantFiles.forEach((file) => {
      lines.push(`- ${file}`);
    });

    lines.push('', '## Agent 配置');
    this.config.agents.forEach((agent) => {
      lines.push('', `### ${agent.name}`);
      lines.push(`- 描述: ${agent.description}`);
      if (agent.tools) {
        lines.push(`- 能力: ${agent.tools.join(', ')}`);
      }
      if (agent.model) {
        lines.push(`- 模型: ${agent.model}`);
      }
    });

    lines.push('', '## 工作流偏好');
    this.config.rules.forEach((rule) => {
      lines.push(`- ${rule}`);
    });

    return lines.join('\n');
  }

  getConfig(): AgentsMdConfig | null {
    return this.config;
  }

  updateConfig(updates: Partial<AgentsMdConfig>): void {
    if (!this.config) return;
    this.config = { ...this.config, ...updates };
    this.save();
  }

  addAgent(agent: AgentConfig): void {
    if (!this.config) return;
    this.config.agents.push(agent);
    this.save();
  }

  removeAgent(name: string): void {
    if (!this.config) return;
    this.config.agents = this.config.agents.filter((a) => a.name !== name);
    this.save();
  }

  getAgent(name: string): AgentConfig | undefined {
    return this.config?.agents.find((a) => a.name === name);
  }

  getDefaultAgent(): AgentConfig | undefined {
    return this.config?.agents[0];
  }

  getSystemPrompt(): string {
    if (!this.config) return '';

    const parts: string[] = [];

    if (this.config.project.description) {
      parts.push(`项目: ${this.config.project.name}`);
      parts.push(`描述: ${this.config.project.description}`);
    }

    if (this.config.project.context.techStack.length > 0) {
      parts.push(`\n技术栈: ${this.config.project.context.techStack.join(', ')}`);
    }

    if (this.config.rules.length > 0) {
      parts.push('\n编码规范:');
      this.config.rules.forEach((rule) => {
        parts.push(`- ${rule}`);
      });
    }

    return parts.join('\n');
  }

  exportConfig(): string {
    return this.generateAgentsMd();
  }

  importConfig(content: string): boolean {
    try {
      this.config = this.parseAgentsMd(content);
      this.save();
      return true;
    } catch {
      return false;
    }
  }

  reset(): void {
    localStorage.removeItem('lcs-agents-md');
    this.config = null;
  }
}

export const agentsMdManager = new AgentsMdManager();
