import { tokenTrackerService } from './tokenTracker';
import type { ToolDefinition, ToolCall } from './autoExecutor/types';
import { BUILTIN_TOOLS } from './autoExecutor/types';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: ToolDefinition[];
}

export interface ChatCompletionResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'deepseek' | 'local' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  enableTools?: boolean;
}

const DEFAULT_CONFIG: LLMConfig = {
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  enableTools: true,
};

const PROVIDER_CONFIGS: Record<string, { baseUrl: string; models: string[] }> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-coder'],
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
  },
  local: {
    baseUrl: 'http://localhost:11434/v1',
    models: ['llama3', 'mistral', 'codellama'],
  },
};

class LLMService {
  private config: LLMConfig = DEFAULT_CONFIG;
  private abortController: AbortController | null = null;

  setConfig(config: Partial<LLMConfig>) {
    this.config = { ...this.config, ...config };
    console.log('LLM Config updated:', { 
      provider: this.config.provider, 
      baseUrl: this.config.baseUrl, 
      model: this.config.model,
      hasApiKey: !!this.config.apiKey,
      enableTools: this.config.enableTools,
    });
  }

  getConfig(): LLMConfig {
    return { ...this.config };
  }

  getProviderConfig(provider: string) {
    return PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.deepseek;
  }

  getAvailableProviders() {
    return Object.keys(PROVIDER_CONFIGS);
  }

  getAvailableModels(provider?: string) {
    const p = provider || this.config.provider;
    return PROVIDER_CONFIGS[p]?.models || [];
  }

  async chat(messages: ChatMessage[], options?: Partial<ChatCompletionRequest>): Promise<string> {
    this.abortController = new AbortController();

    if (!this.config.apiKey && this.config.provider !== 'local') {
      console.log('No API key configured');
      return '⚠️ 请在设置中配置 API Key 以启用真实对话功能。';
    }

    try {
      const endpoint = this.getEndpoint();
      console.log('Calling API:', endpoint);

      const tools = this.config.enableTools ? this.formatTools() : undefined;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          messages: this.formatMessages(messages),
          model: this.config.model,
          temperature: 0.7,
          max_tokens: 4096,
          tools,
          ...options,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`API请求失败: ${response.status} - ${errorText}`);
      }

      const data: ChatCompletionResponse = await response.json();
      
      if (data.usage) {
        tokenTrackerService.recordUsage(
          this.config.provider,
          this.config.model || 'unknown',
          data.usage.prompt_tokens,
          data.usage.completion_tokens
        );
      }
      
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return '[已取消]';
      }
      console.error('LLM服务错误:', error);
      throw error;
    }
  }

  async chatWithTools(
    messages: ChatMessage[],
    onToolCall?: (calls: ToolCall[]) => Promise<ChatMessage[]>
  ): Promise<{ content: string; toolCalls?: ToolCall[]; finishReason: string }> {
    this.abortController = new AbortController();

    if (!this.config.apiKey && this.config.provider !== 'local') {
      return {
        content: '⚠️ 请在设置中配置 API Key 以启用真实工具调用功能。',
        finishReason: 'stop',
      };
    }

    try {
      const endpoint = this.getEndpoint();
      const tools = this.formatTools();

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          messages: this.formatMessages(messages),
          model: this.config.model,
          temperature: 0.7,
          max_tokens: 4096,
          tools,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API请求失败: ${response.status} - ${errorText}`);
      }

      const data: ChatCompletionResponse = await response.json();
      
      if (data.usage) {
        tokenTrackerService.recordUsage(
          this.config.provider,
          this.config.model || 'unknown',
          data.usage.prompt_tokens,
          data.usage.completion_tokens
        );
      }

      const choice = data.choices[0];
      const toolCalls: ToolCall[] = [];

      if (choice?.message?.tool_calls) {
        for (const tc of choice.message.tool_calls) {
          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
          });
        }
      }

      if (toolCalls.length > 0 && onToolCall) {
        const toolResponses = await onToolCall(toolCalls);
        messages.push(...toolResponses);
        
        return this.chatWithTools(messages, onToolCall);
      }

      return {
        content: choice?.message?.content || '',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: choice?.finish_reason || 'stop',
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { content: '[已取消]', finishReason: 'stop' };
      }
      throw error;
    }
  }

  async chatForExecutor(messages: ChatMessage[]): Promise<{
    content: string;
    toolCalls?: ToolCall[];
    finishReason: string;
  }> {
    this.abortController = new AbortController();

    if (!this.config.apiKey && this.config.provider !== 'local') {
      return {
        content: '⚠️ 请在设置中配置 API Key 以启用自动执行功能。',
        finishReason: 'stop',
      };
    }

    try {
      const endpoint = this.getEndpoint();
      const tools = this.formatTools();

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          messages: this.formatMessages(messages),
          model: this.config.model,
          temperature: 0.7,
          max_tokens: 4096,
          tools,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API请求失败: ${response.status} - ${errorText}`);
      }

      const data: ChatCompletionResponse = await response.json();
      
      if (data.usage) {
        tokenTrackerService.recordUsage(
          this.config.provider,
          this.config.model || 'unknown',
          data.usage.prompt_tokens,
          data.usage.completion_tokens
        );
      }

      const choice = data.choices[0];
      const toolCalls: ToolCall[] = [];

      if (choice?.message?.tool_calls) {
        for (const tc of choice.message.tool_calls) {
          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
          });
        }
      }

      return {
        content: choice?.message?.content || '',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: choice?.finish_reason || 'stop',
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { content: '[已取消]', finishReason: 'stop' };
      }
      throw error;
    }
  }

  private getEndpoint(): string {
    const base = this.config.baseUrl || PROVIDER_CONFIGS[this.config.provider]?.baseUrl || '';
    if (this.config.provider === 'anthropic') {
      return `${base}/messages`;
    }
    return `${base}/chat/completions`;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.provider === 'anthropic') {
      headers['x-api-key'] = this.config.apiKey || '';
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  private formatMessages(messages: ChatMessage[]): unknown[] {
    if (this.config.provider === 'anthropic') {
      return messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'tool' ? 'user' : m.role,
          content: m.content,
        }));
    }

    return messages.map(m => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: m.toolCallId,
          content: m.content,
        };
      }
      
      if (m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }
      
      return {
        role: m.role,
        content: m.content,
      };
    });
  }

  private formatTools(): ToolDefinition[] {
    return BUILTIN_TOOLS.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    })) as unknown as ToolDefinition[];
  }

  abort() {
    this.abortController?.abort();
  }
}

export const llmService = new LLMService();
