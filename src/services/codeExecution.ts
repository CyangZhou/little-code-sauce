export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  language: string;
}

export interface CodeExecutor {
  execute(code: string): Promise<ExecutionResult>;
  supportedLanguages: string[];
}

class JavaScriptExecutor implements CodeExecutor {
  supportedLanguages = ['javascript', 'js', 'typescript', 'ts'];

  async execute(code: string): Promise<ExecutionResult> {
    const startTime = performance.now();
    
    try {
      const logs: string[] = [];
      const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
      };

      const mockConsole = {
        log: (...args: any[]) => logs.push(args.map(a => 
          typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
        ).join(' ')),
        error: (...args: any[]) => logs.push('[ERROR] ' + args.map(a => 
          typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
        ).join(' ')),
        warn: (...args: any[]) => logs.push('[WARN] ' + args.map(a => 
          typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
        ).join(' ')),
      };

      const safeCode = code
        .replace(/import\s+/g, '// import ')
        .replace(/require\s*\(/g, '// require(')
        .replace(/export\s+/g, '// export ');

      const fn = new Function('console', safeCode);
      fn(mockConsole);

      Object.assign(console, originalConsole);

      return {
        success: true,
        output: logs.join('\n') || '(无输出)',
        duration: performance.now() - startTime,
        language: 'javascript',
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        duration: performance.now() - startTime,
        language: 'javascript',
      };
    }
  }
}

class PythonExecutor implements CodeExecutor {
  supportedLanguages = ['python', 'py'];

  async execute(_code: string): Promise<ExecutionResult> {
    const startTime = performance.now();
    
    return {
      success: false,
      output: '',
      error: 'Python执行需要后端服务支持。当前为前端模拟环境。\n\n提示：可以配置Pyodide或连接到后端API来执行Python代码。',
      duration: performance.now() - startTime,
      language: 'python',
    };
  }
}

class MockExecutor implements CodeExecutor {
  supportedLanguages = ['*'];

  async execute(code: string, language: string = 'plaintext'): Promise<ExecutionResult> {
    const startTime = performance.now();
    
    return {
      success: true,
      output: `// 模拟执行结果\n// 语言: ${language}\n// 代码长度: ${code.length} 字符\n\n// 实际执行需要配置相应的运行时环境`,
      duration: performance.now() - startTime,
      language,
    };
  }
}

export class CodeExecutionService {
  private executors: Map<string, CodeExecutor> = new Map();
  private mockExecutor = new MockExecutor();

  constructor() {
    this.registerExecutor(new JavaScriptExecutor());
    this.registerExecutor(new PythonExecutor());
  }

  registerExecutor(executor: CodeExecutor) {
    for (const lang of executor.supportedLanguages) {
      this.executors.set(lang.toLowerCase(), executor);
    }
  }

  async execute(code: string, language: string): Promise<ExecutionResult> {
    const executor = this.executors.get(language.toLowerCase());
    
    if (executor) {
      return executor.execute(code);
    }
    
    return this.mockExecutor.execute(code, language);
  }

  getSupportedLanguages(): string[] {
    return Array.from(this.executors.keys());
  }
}

export const codeExecutionService = new CodeExecutionService();
