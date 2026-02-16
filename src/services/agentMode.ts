export type AgentMode = 'build' | 'plan';

export interface AgentModeConfig {
  mode: AgentMode;
  allowWrite: boolean;
  allowDelete: boolean;
  allowExecute: boolean;
  allowNetwork: boolean;
  requireConfirmation: boolean;
  description: string;
}

export interface ExecutionPlan {
  id: string;
  createdAt: number;
  task: string;
  steps: ExecutionStep[];
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed';
  estimatedRisk: 'low' | 'medium' | 'high';
}

export interface ExecutionStep {
  id: string;
  type: 'read' | 'write' | 'edit' | 'delete' | 'execute' | 'search' | 'web';
  description: string;
  target?: string;
  content?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

export const AGENT_MODE_CONFIGS: Record<AgentMode, AgentModeConfig> = {
  build: {
    mode: 'build',
    allowWrite: true,
    allowDelete: true,
    allowExecute: true,
    allowNetwork: true,
    requireConfirmation: false,
    description: '完整开发模式 - 允许所有操作',
  },
  plan: {
    mode: 'plan',
    allowWrite: false,
    allowDelete: false,
    allowExecute: false,
    allowNetwork: true,
    requireConfirmation: true,
    description: '只读分析模式 - 文件修改需要确认',
  },
};

export class AgentModeService {
  private currentMode: AgentMode = 'build';

  setMode(mode: AgentMode) {
    this.currentMode = mode;
  }

  getMode(): AgentMode {
    return this.currentMode;
  }

  getConfig(): AgentModeConfig {
    return AGENT_MODE_CONFIGS[this.currentMode];
  }

  canPerformAction(action: 'write' | 'delete' | 'execute' | 'network'): boolean {
    const config = this.getConfig();
    switch (action) {
      case 'write':
        return config.allowWrite;
      case 'delete':
        return config.allowDelete;
      case 'execute':
        return config.allowExecute;
      case 'network':
        return config.allowNetwork;
      default:
        return false;
    }
  }

  requiresConfirmation(): boolean {
    return this.getConfig().requireConfirmation;
  }
}

export const agentModeService = new AgentModeService();
