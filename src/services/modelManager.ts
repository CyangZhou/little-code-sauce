export type ModelProvider = 'deepseek' | 'openai' | 'anthropic' | 'google' | 'local' | 'custom';

export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  apiKey?: string;
  baseUrl?: string;
  maxTokens: number;
  supportsStreaming: boolean;
  supportsVision: boolean;
  pricing?: {
    input: number;
    output: number;
    unit: 'per-million-tokens';
  };
}

export interface ProviderConfig {
  name: string;
  displayName: string;
  models: ModelConfig[];
  defaultModel: string;
  icon: string;
  description: string;
}

export const MODEL_PROVIDERS: Record<ModelProvider, ProviderConfig> = {
  deepseek: {
    name: 'deepseek',
    displayName: 'DeepSeek',
    icon: '🧠',
    description: '高性价比，中文支持优秀',
    defaultModel: 'deepseek-chat',
    models: [
      {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        maxTokens: 8192,
        supportsStreaming: true,
        supportsVision: false,
        pricing: { input: 0.14, output: 0.28, unit: 'per-million-tokens' },
      },
      {
        id: 'deepseek-reasoner',
        name: 'DeepSeek Reasoner',
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        maxTokens: 8192,
        supportsStreaming: true,
        supportsVision: false,
        pricing: { input: 0.55, output: 2.19, unit: 'per-million-tokens' },
      },
    ],
  },
  openai: {
    name: 'openai',
    displayName: 'OpenAI',
    icon: '🤖',
    description: 'GPT系列，业界标杆',
    defaultModel: 'gpt-4o',
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        maxTokens: 16384,
        supportsStreaming: true,
        supportsVision: true,
        pricing: { input: 2.5, output: 10, unit: 'per-million-tokens' },
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        maxTokens: 16384,
        supportsStreaming: true,
        supportsVision: true,
        pricing: { input: 0.15, output: 0.6, unit: 'per-million-tokens' },
      },
      {
        id: 'o1',
        name: 'o1',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        maxTokens: 100000,
        supportsStreaming: false,
        supportsVision: true,
        pricing: { input: 15, output: 60, unit: 'per-million-tokens' },
      },
    ],
  },
  anthropic: {
    name: 'anthropic',
    displayName: 'Anthropic',
    icon: '🎭',
    description: 'Claude系列，推理能力强',
    defaultModel: 'claude-sonnet-4-20250514',
    models: [
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        provider: 'anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        maxTokens: 64000,
        supportsStreaming: true,
        supportsVision: true,
        pricing: { input: 3, output: 15, unit: 'per-million-tokens' },
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        provider: 'anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        maxTokens: 8192,
        supportsStreaming: true,
        supportsVision: true,
        pricing: { input: 0.8, output: 4, unit: 'per-million-tokens' },
      },
    ],
  },
  google: {
    name: 'google',
    displayName: 'Google',
    icon: '🌟',
    description: 'Gemini系列，多模态支持',
    defaultModel: 'gemini-2.0-flash',
    models: [
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        provider: 'google',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        maxTokens: 32768,
        supportsStreaming: true,
        supportsVision: true,
        pricing: { input: 0.1, output: 0.4, unit: 'per-million-tokens' },
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'google',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        maxTokens: 65536,
        supportsStreaming: true,
        supportsVision: true,
        pricing: { input: 1.25, output: 5, unit: 'per-million-tokens' },
      },
    ],
  },
  local: {
    name: 'local',
    displayName: '本地模型',
    icon: '🏠',
    description: 'Ollama等本地部署模型',
    defaultModel: 'llama3',
    models: [
      {
        id: 'llama3',
        name: 'Llama 3',
        provider: 'local',
        baseUrl: 'http://localhost:11434/v1',
        maxTokens: 8192,
        supportsStreaming: true,
        supportsVision: false,
      },
      {
        id: 'qwen2.5',
        name: 'Qwen 2.5',
        provider: 'local',
        baseUrl: 'http://localhost:11434/v1',
        maxTokens: 32768,
        supportsStreaming: true,
        supportsVision: false,
      },
      {
        id: 'deepseek-coder',
        name: 'DeepSeek Coder',
        provider: 'local',
        baseUrl: 'http://localhost:11434/v1',
        maxTokens: 16384,
        supportsStreaming: true,
        supportsVision: false,
      },
    ],
  },
  custom: {
    name: 'custom',
    displayName: '自定义',
    icon: '⚙️',
    description: '自定义API端点',
    defaultModel: 'custom',
    models: [
      {
        id: 'custom',
        name: '自定义模型',
        provider: 'custom',
        maxTokens: 8192,
        supportsStreaming: true,
        supportsVision: false,
      },
    ],
  },
};

export class ModelManager {
  private currentModel: string = 'deepseek-chat';
  private currentProvider: ModelProvider = 'deepseek';
  private apiKeys: Map<ModelProvider, string> = new Map();
  private customConfigs: Map<string, Partial<ModelConfig>> = new Map();

  getCurrentModel(): string {
    return this.currentModel;
  }

  getCurrentProvider(): ModelProvider {
    return this.currentProvider;
  }

  setCurrentModel(modelId: string) {
    for (const [provider, config] of Object.entries(MODEL_PROVIDERS)) {
      const model = config.models.find(m => m.id === modelId);
      if (model) {
        this.currentModel = modelId;
        this.currentProvider = provider as ModelProvider;
        return;
      }
    }
    console.warn(`Model ${modelId} not found, keeping current model`);
  }

  getModelConfig(modelId?: string): ModelConfig | undefined {
    const id = modelId || this.currentModel;
    for (const config of Object.values(MODEL_PROVIDERS)) {
      const model = config.models.find(m => m.id === id);
      if (model) {
        return { ...model, ...this.customConfigs.get(id) };
      }
    }
    return undefined;
  }

  getProviderConfig(provider?: ModelProvider): ProviderConfig | undefined {
    return MODEL_PROVIDERS[provider || this.currentProvider];
  }

  setApiKey(provider: ModelProvider, apiKey: string) {
    this.apiKeys.set(provider, apiKey);
  }

  getApiKey(provider?: ModelProvider): string | undefined {
    return this.apiKeys.get(provider || this.currentProvider);
  }

  hasApiKey(provider?: ModelProvider): boolean {
    return this.apiKeys.has(provider || this.currentProvider);
  }

  setCustomConfig(modelId: string, config: Partial<ModelConfig>) {
    this.customConfigs.set(modelId, config);
  }

  getAllModels(): ModelConfig[] {
    return Object.values(MODEL_PROVIDERS).flatMap(p => p.models);
  }

  getAllProviders(): ProviderConfig[] {
    return Object.values(MODEL_PROVIDERS);
  }

  getRecommendedModels(): ModelConfig[] {
    return [
      MODEL_PROVIDERS.deepseek.models[0],
      MODEL_PROVIDERS.openai.models[0],
      MODEL_PROVIDERS.anthropic.models[0],
      MODEL_PROVIDERS.google.models[0],
    ];
  }

  estimateCost(inputTokens: number, outputTokens: number, modelId?: string): number {
    const model = this.getModelConfig(modelId);
    if (!model?.pricing) return 0;

    const inputCost = (inputTokens / 1_000_000) * model.pricing.input;
    const outputCost = (outputTokens / 1_000_000) * model.pricing.output;
    return inputCost + outputCost;
  }

  getModelStatus(): { configured: boolean; hasKey: boolean; model: ModelConfig | undefined } {
    const model = this.getModelConfig();
    return {
      configured: !!model,
      hasKey: this.hasApiKey(),
      model,
    };
  }
}

export const modelManager = new ModelManager();
