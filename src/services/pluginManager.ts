export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  icon?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  license?: string;
  capabilities?: PluginCapability[];
  hooks?: PluginHook[];
  config?: PluginConfigSchema;
}

export interface PluginCapability {
  name: string;
  description: string;
}

export type PluginHookType = 
  | 'onMessage' 
  | 'onCodeGenerated' 
  | 'onFileChange' 
  | 'onSessionStart' 
  | 'onSessionEnd'
  | 'onToolExecute'
  | 'onCommand';

export interface PluginHook {
  type: PluginHookType;
  priority?: number;
}

export interface PluginConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'select';
    default?: unknown;
    description?: string;
    options?: string[];
    required?: boolean;
  };
}

export interface PluginInstance {
  manifest: PluginManifest;
  enabled: boolean;
  config: Record<string, unknown>;
  installed: boolean;
}

export interface PluginContext {
  config: Record<string, unknown>;
  sendMessage: (message: string) => void;
  executeCommand: (command: string, args?: unknown[]) => Promise<unknown>;
  log: (message: string, level?: 'info' | 'warn' | 'error') => void;
  storage: {
    get: <T>(key: string) => T | undefined;
    set: (key: string, value: unknown) => void;
    delete: (key: string) => void;
  };
}

export type PluginHookHandler = (
  data: unknown,
  context: PluginContext
) => Promise<unknown> | unknown;

interface PluginState {
  plugins: Map<string, PluginInstance>;
  hooks: Map<PluginHookType, Map<string, PluginHookHandler>>;
}

class PluginManager {
  private state: PluginState = {
    plugins: new Map(),
    hooks: new Map(),
  };

  private storage: Map<string, Map<string, unknown>> = new Map();

  async loadPlugin(manifest: PluginManifest): Promise<boolean> {
    if (this.state.plugins.has(manifest.id)) {
      console.warn(`Plugin ${manifest.id} already loaded`);
      return false;
    }

    const instance: PluginInstance = {
      manifest,
      enabled: true,
      config: this.getDefaultConfig(manifest),
      installed: true,
    };

    this.state.plugins.set(manifest.id, instance);
    this.storage.set(manifest.id, new Map());

    if (manifest.hooks) {
      manifest.hooks.forEach((hook) => {
        this.registerHook(manifest.id, hook.type, async (data) => data);
      });
    }

    console.log(`Plugin loaded: ${manifest.name} v${manifest.version}`);
    return true;
  }

  unloadPlugin(pluginId: string): boolean {
    const instance = this.state.plugins.get(pluginId);
    if (!instance) return false;

    this.state.plugins.delete(pluginId);
    this.storage.delete(pluginId);

    this.state.hooks.forEach((handlers) => {
      handlers.delete(pluginId);
    });

    console.log(`Plugin unloaded: ${instance.manifest.name}`);
    return true;
  }

  enablePlugin(pluginId: string): boolean {
    const instance = this.state.plugins.get(pluginId);
    if (!instance) return false;
    instance.enabled = true;
    return true;
  }

  disablePlugin(pluginId: string): boolean {
    const instance = this.state.plugins.get(pluginId);
    if (!instance) return false;
    instance.enabled = false;
    return true;
  }

  private getDefaultConfig(manifest: PluginManifest): Record<string, unknown> {
    const config: Record<string, unknown> = {};
    if (manifest.config) {
      Object.entries(manifest.config).forEach(([key, schema]) => {
        config[key] = schema.default;
      });
    }
    return config;
  }

  setPluginConfig(pluginId: string, config: Record<string, unknown>): boolean {
    const instance = this.state.plugins.get(pluginId);
    if (!instance) return false;
    instance.config = { ...instance.config, ...config };
    return true;
  }

  getPluginConfig(pluginId: string): Record<string, unknown> | undefined {
    return this.state.plugins.get(pluginId)?.config;
  }

  registerHook(
    pluginId: string,
    hookType: PluginHookType,
    handler: PluginHookHandler
  ): void {
    if (!this.state.hooks.has(hookType)) {
      this.state.hooks.set(hookType, new Map());
    }
    this.state.hooks.get(hookType)!.set(pluginId, handler);
  }

  async executeHook(hookType: PluginHookType, data: unknown): Promise<unknown> {
    const handlers = this.state.hooks.get(hookType);
    if (!handlers) return data;

    let result = data;
    for (const [pluginId, handler] of handlers) {
      const instance = this.state.plugins.get(pluginId);
      if (!instance?.enabled) continue;

      const context = this.createContext(pluginId);
      try {
        result = await handler(result, context);
      } catch (error) {
        console.error(`Plugin ${pluginId} hook error:`, error);
      }
    }

    return result;
  }

  private createContext(pluginId: string): PluginContext {
    return {
      config: this.getPluginConfig(pluginId) || {},
      sendMessage: (message: string) => {
        console.log(`[${pluginId}] ${message}`);
      },
      executeCommand: async (command: string, args?: unknown[]) => {
        console.log(`[${pluginId}] Execute: ${command}`, args);
        return null;
      },
      log: (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
        const prefix = `[${pluginId}]`;
        switch (level) {
          case 'error':
            console.error(prefix, message);
            break;
          case 'warn':
            console.warn(prefix, message);
            break;
          default:
            console.log(prefix, message);
        }
      },
      storage: {
        get: <T>(key: string): T | undefined => {
          return this.storage.get(pluginId)?.get(key) as T | undefined;
        },
        set: (key: string, value: unknown) => {
          this.storage.get(pluginId)?.set(key, value);
        },
        delete: (key: string) => {
          this.storage.get(pluginId)?.delete(key);
        },
      },
    };
  }

  getPlugins(): PluginInstance[] {
    return Array.from(this.state.plugins.values());
  }

  getPlugin(pluginId: string): PluginInstance | undefined {
    return this.state.plugins.get(pluginId);
  }

  getEnabledPlugins(): PluginInstance[] {
    return this.getPlugins().filter((p) => p.enabled);
  }

  exportConfig(): string {
    const config = {
      plugins: this.getPlugins().map((p) => ({
        id: p.manifest.id,
        enabled: p.enabled,
        config: p.config,
      })),
    };
    return JSON.stringify(config, null, 2);
  }

  importConfig(data: string): boolean {
    try {
      const config = JSON.parse(data);
      config.plugins?.forEach((p: { id: string; enabled: boolean; config: Record<string, unknown> }) => {
        const instance = this.state.plugins.get(p.id);
        if (instance) {
          instance.enabled = p.enabled;
          instance.config = p.config;
        }
      });
      return true;
    } catch {
      return false;
    }
  }
}

export const pluginManager = new PluginManager();

export const BUILTIN_PLUGINS: PluginManifest[] = [
  {
    id: 'lcs-code-assist',
    name: '代码助手',
    version: '1.0.0',
    description: '智能代码补全和重构建议',
    author: 'Little Code Sauce',
    main: 'builtin',
    capabilities: [
      { name: 'completion', description: '代码补全' },
      { name: 'refactor', description: '重构建议' },
    ],
    hooks: [
      { type: 'onCodeGenerated', priority: 10 },
    ],
  },
  {
    id: 'lcs-session-sync',
    name: '会话同步',
    version: '1.0.0',
    description: '自动保存和同步会话',
    author: 'Little Code Sauce',
    main: 'builtin',
    capabilities: [
      { name: 'autosave', description: '自动保存' },
      { name: 'sync', description: '云端同步' },
    ],
    hooks: [
      { type: 'onSessionEnd', priority: 5 },
    ],
  },
  {
    id: 'lcs-context-enhancer',
    name: '上下文增强',
    version: '1.0.0',
    description: '智能上下文管理和压缩',
    author: 'Little Code Sauce',
    main: 'builtin',
    capabilities: [
      { name: 'compress', description: '上下文压缩' },
      { name: 'summarize', description: '摘要生成' },
    ],
    hooks: [
      { type: 'onMessage', priority: 1 },
    ],
  },
];

export function initializeBuiltinPlugins() {
  BUILTIN_PLUGINS.forEach((manifest) => {
    pluginManager.loadPlugin(manifest);
  });
}
