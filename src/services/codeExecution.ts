import { codeAnalysisService } from './codeAnalysis';

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  logs: string[];
}

export interface TestResult {
  passed: number;
  failed: number;
  total: number;
  results: {
    name: string;
    passed: boolean;
    error?: string;
    duration: number;
  }[];
}

class CodeExecutionService {
  private logs: string[] = [];

  private log(message: string) {
    this.logs.push(message);
  }

  private createSandbox() {
    const sandbox: Record<string, unknown> = {
      console: {
        log: (...args: unknown[]) => this.log(args.map(a => this.stringify(a)).join(' ')),
        error: (...args: unknown[]) => this.log('[ERROR] ' + args.map(a => this.stringify(a)).join(' ')),
        warn: (...args: unknown[]) => this.log('[WARN] ' + args.map(a => this.stringify(a)).join(' ')),
        info: (...args: unknown[]) => this.log('[INFO] ' + args.map(a => this.stringify(a)).join(' ')),
        debug: (...args: unknown[]) => this.log('[DEBUG] ' + args.map(a => this.stringify(a)).join(' ')),
      },
      setTimeout: (fn: () => void, ms: number) => setTimeout(fn, Math.min(ms, 5000)),
      setInterval: (fn: () => void, ms: number) => setInterval(fn, Math.min(ms, 5000)),
      clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
      clearInterval: (id: ReturnType<typeof setInterval>) => clearInterval(id),
      Math,
      Date,
      JSON,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Map,
      Set,
      Promise,
      Symbol,
      Error,
      TypeError,
      RangeError,
      RegExp,
    };

    return sandbox;
  }

  private stringify(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    if (typeof value === 'function') return `[Function: ${value.name || 'anonymous'}]`;
    
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  executeJavaScript(code: string): ExecutionResult {
    this.logs = [];
    const startTime = Date.now();

    try {
      const sandbox = this.createSandbox();
      const sandboxKeys = Object.keys(sandbox);
      const sandboxValues = Object.values(sandbox);

      const wrappedCode = `
        (function(${sandboxKeys.join(', ')}) {
          "use strict";
          ${code}
        })
      `;

      const fn = eval(wrappedCode);
      const result = fn(...sandboxValues);

      const duration = Date.now() - startTime;

      let output = '';
      if (this.logs.length > 0) {
        output += this.logs.join('\n');
      }
      if (result !== undefined) {
        if (output) output += '\n\n';
        output += '返回值:\n' + this.stringify(result);
      }

      return {
        success: true,
        output: output || '(无输出)',
        duration,
        logs: this.logs,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        output: '',
        error: errorMessage,
        duration,
        logs: this.logs,
      };
    }
  }

  executeTypeScript(code: string): ExecutionResult {
    const transpiledCode = this.transpileTypeScript(code);
    return this.executeJavaScript(transpiledCode);
  }

  private transpileTypeScript(code: string): string {
    let result = code;

    result = result.replace(/:\s*(string|number|boolean|any|void|unknown|never|object|symbol|bigint|null|undefined)\s*(,|\)|=|\{|\[|;|\n)/g, '$2');
    result = result.replace(/:\s*(string|number|boolean|any|void|unknown|never|object|symbol|bigint|null|undefined)\s*$/gm, '');
    result = result.replace(/:\s*(string|number|boolean|any|void|unknown|never|object|symbol|bigint|null|undefined)\s*\)/g, ')');
    
    result = result.replace(/<[^>]+>/g, '');
    
    result = result.replace(/interface\s+\w+\s*\{[^}]*\}/g, '');
    result = result.replace(/type\s+\w+\s*=\s*[^;]+;/g, '');
    
    result = result.replace(/as\s+\w+/g, '');
    
    result = result.replace(/private\s+/g, '');
    result = result.replace(/public\s+/g, '');
    result = result.replace(/protected\s+/g, '');
    result = result.replace(/readonly\s+/g, '');
    
    result = result.replace(/enum\s+(\w+)\s*\{([^}]*)\}/g, (_, name, body) => {
      const members = body.split(',').map((m: string) => m.trim()).filter(Boolean);
      const obj = members.map((m: string, i: number) => `${m}: ${i}`).join(', ');
      return `const ${name} = { ${obj} };`;
    });

    return result;
  }

  executePython(code: string): ExecutionResult {
    this.logs = [];
    const startTime = Date.now();

    const transpiled = this.transpilePython(code);
    
    try {
      const result = this.executeJavaScript(transpiled);
      return {
        ...result,
        output: result.output.replace(/\[Python模拟\]/g, ''),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Python执行错误: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime,
        logs: this.logs,
      };
    }
  }

  private transpilePython(code: string): string {
    let result = code;

    result = result.replace(/def\s+(\w+)\s*\(([^)]*)\):/g, 'function $1($2) {');
    result = result.replace(/class\s+(\w+)\s*(?:\(([^)]*)\))?:/g, 'class $1 {');
    result = result.replace(/if\s+(.+):/g, 'if ($1) {');
    result = result.replace(/elif\s+(.+):/g, '} else if ($1) {');
    result = result.replace(/else:/g, '} else {');
    result = result.replace(/for\s+(\w+)\s+in\s+(.+):/g, 'for (const $1 of $2) {');
    result = result.replace(/while\s+(.+):/g, 'while ($1) {');
    result = result.replace(/return\s+(.+)/g, 'return $1;');
    result = result.replace(/print\s*\(([^)]*)\)/g, 'console.log($1)');
    result = result.replace(/len\s*\(([^)]*)\)/g, '$1.length');
    result = result.replace(/range\s*\(([^)]*)\)/g, 'Array.from({length: $1}, (_, i) => i)');
    result = result.replace(/True/g, 'true');
    result = result.replace(/False/g, 'false');
    result = result.replace(/None/g, 'null');
    result = result.replace(/and/g, '&&');
    result = result.replace(/or/g, '||');
    result = result.replace(/not\s+/g, '!');
    result = result.replace(/self\./g, 'this.');
    result = result.replace(/__init__/g, 'constructor');
    result = result.replace(/def\s+/g, '');
    result = result.replace(/:\s*$/gm, ' {');
    result = result.replace(/^(\s*)return(.*)$/gm, '$1return$2;');
    result = result.replace(/^(\s*)(\w+)\s*=\s*(.+)$/gm, '$1const $2 = $3;');
    result = result.replace(/"""([^"]*)"""/g, '`$1`');
    result = result.replace(/'''([^']*)'''/g, '`$1`');
    result = result.replace(/#.*$/gm, '');
    result = result.replace(/^(\s*)$/gm, '$1}');

    return `// [Python模拟]\n${result}`;
  }

  execute(code: string, language: string = 'javascript'): ExecutionResult {
    switch (language.toLowerCase()) {
      case 'typescript':
      case 'ts':
      case 'tsx':
        return this.executeTypeScript(code);
      case 'python':
      case 'py':
        return this.executePython(code);
      case 'javascript':
      case 'js':
      case 'jsx':
      default:
        return this.executeJavaScript(code);
    }
  }

  runTests(testCode: string): TestResult {
    const results: TestResult['results'] = [];
    const startTime = Date.now();

    try {
      const testFramework = this.createTestFramework(results);
      const wrappedCode = `
        (function(describe, it, expect, beforeEach, afterEach) {
          ${testCode}
        })
      `;
      
      const fn = eval(wrappedCode);
      fn(
        testFramework.describe,
        testFramework.it,
        testFramework.expect,
        testFramework.beforeEach,
        testFramework.afterEach
      );

      const passed = results.filter(r => r.passed).length;
      const failed = results.filter(r => !r.passed).length;

      return {
        passed,
        failed,
        total: results.length,
        results,
      };
    } catch (error) {
      return {
        passed: 0,
        failed: 1,
        total: 1,
        results: [{
          name: 'Test Execution',
          passed: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
        }],
      };
    }
  }

  private createTestFramework(results: TestResult['results']) {
    let currentDescribe = '';

    const describe = (name: string, fn: () => void) => {
      currentDescribe = name;
      fn();
      currentDescribe = '';
    };

    const it = (name: string, fn: () => void) => {
      const testName = currentDescribe ? `${currentDescribe} - ${name}` : name;
      const startTime = Date.now();
      
      try {
        fn();
        results.push({
          name: testName,
          passed: true,
          duration: Date.now() - startTime,
        });
      } catch (error) {
        results.push({
          name: testName,
          passed: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
        });
      }
    };

    const expect = (actual: unknown) => ({
      toBe: (expected: unknown) => {
        if (actual !== expected) {
          throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
        }
      },
      toEqual: (expected: unknown) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
        }
      },
      toBeTruthy: () => {
        if (!actual) {
          throw new Error(`Expected truthy value but got ${JSON.stringify(actual)}`);
        }
      },
      toBeFalsy: () => {
        if (actual) {
          throw new Error(`Expected falsy value but got ${JSON.stringify(actual)}`);
        }
      },
      toContain: (expected: unknown) => {
        if (!Array.isArray(actual) || !actual.includes(expected)) {
          throw new Error(`Expected array to contain ${JSON.stringify(expected)}`);
        }
      },
      toBeGreaterThan: (expected: number) => {
        if (typeof actual !== 'number' || actual <= expected) {
          throw new Error(`Expected ${actual} to be greater than ${expected}`);
        }
      },
      toBeLessThan: (expected: number) => {
        if (typeof actual !== 'number' || actual >= expected) {
          throw new Error(`Expected ${actual} to be less than ${expected}`);
        }
      },
    });

    const beforeEach = (fn: () => void) => {
      void fn;
    };
    const afterEach = (fn: () => void) => {
      void fn;
    };

    return { describe, it, expect, beforeEach, afterEach };
  }

  format(code: string, language: string = 'javascript'): string {
    void language;
    const lines = code.split('\n');
    const formatted: string[] = [];
    let indentLevel = 0;
    const indentStr = '  ';

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (!trimmed) {
        formatted.push('');
        continue;
      }

      if (trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      formatted.push(indentStr.repeat(indentLevel) + trimmed);

      const openBraces = (trimmed.match(/[{[(]/g) || []).length;
      const closeBraces = (trimmed.match(/[}\])]/g) || []).length;
      indentLevel += openBraces - closeBraces;
      indentLevel = Math.max(0, indentLevel);
    }

    return formatted.join('\n');
  }

  lint(code: string, language: string = 'javascript'): { line: number; message: string; severity: 'error' | 'warning' }[] {
    const issues: { line: number; message: string; severity: 'error' | 'warning' }[] = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      if (line.includes('console.log') && language !== 'typescript') {
        issues.push({
          line: lineNum,
          message: 'Unexpected console.log',
          severity: 'warning',
        });
      }

      if (line.includes('var ') && (language === 'javascript' || language === 'typescript')) {
        issues.push({
          line: lineNum,
          message: 'Use const or let instead of var',
          severity: 'warning',
        });
      }

      if (line.includes('==') && !line.includes('===')) {
        issues.push({
          line: lineNum,
          message: 'Use === instead of ==',
          severity: 'warning',
        });
      }

      if (line.trim().endsWith(';') === false && line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('{') && !line.trim().startsWith('}')) {
        if (!line.trim().endsWith('{') && !line.trim().endsWith(',')) {
          issues.push({
            line: lineNum,
            message: 'Missing semicolon',
            severity: 'warning',
          });
        }
      }

      if (line.length > 100) {
        issues.push({
          line: lineNum,
          message: 'Line exceeds 100 characters',
          severity: 'warning',
        });
      }
    });

    return issues;
  }

  analyzeAndExecute(code: string, language: string = 'javascript'): { analysis: ReturnType<typeof codeAnalysisService.analyzeCode>; execution: ExecutionResult } {
    const analysis = codeAnalysisService.analyzeCode(code, `file.${language}`);
    const execution = this.execute(code, language);

    return { analysis, execution };
  }
}

export const codeExecutionService = new CodeExecutionService();
