export interface CodeAnalysisResult {
  file: string;
  language: string;
  metrics: CodeMetrics;
  issues: CodeIssue[];
  suggestions: CodeSuggestion[];
  dependencies: string[];
}

export interface CodeMetrics {
  linesOfCode: number;
  linesOfComments: number;
  blankLines: number;
  functions: number;
  classes: number;
  complexity: number;
  maintainabilityIndex: number;
}

export interface CodeIssue {
  type: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  rule?: string;
  fix?: string;
}

export interface CodeSuggestion {
  type: 'refactor' | 'optimize' | 'security' | 'style' | 'performance';
  message: string;
  line: number;
  suggestion: string;
  impact: 'high' | 'medium' | 'low';
}

export interface ProjectAnalysis {
  totalFiles: number;
  totalLines: number;
  languages: Record<string, number>;
  dependencies: {
    production: string[];
    development: string[];
    outdated: string[];
    vulnerable: string[];
  };
  structure: FileTreeNode;
  metrics: {
    averageComplexity: number;
    averageMaintainability: number;
    technicalDebt: number;
  };
}

export interface FileTreeNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileTreeNode[];
  size?: number;
  language?: string;
}

export interface ImportInfo {
  source: string;
  specifiers: string[];
  line: number;
  isDefault: boolean;
  isNamespace: boolean;
}

export interface ExportInfo {
  name: string;
  type: 'value' | 'function' | 'class' | 'type' | 'interface';
  line: number;
  isDefault: boolean;
}

class CodeAnalysisService {
  private cache: Map<string, CodeAnalysisResult> = new Map();

  async analyzeFile(content: string, filePath: string): Promise<CodeAnalysisResult> {
    const cached = this.cache.get(filePath);
    if (cached) return cached;

    const language = this.detectLanguage(filePath);
    const metrics = this.calculateMetrics(content, language);
    const issues = this.detectIssues(content, language);
    const suggestions = this.generateSuggestions(content, language);
    const dependencies = this.extractDependencies(content, language);

    const result: CodeAnalysisResult = {
      file: filePath,
      language,
      metrics,
      issues,
      suggestions,
      dependencies,
    };

    this.cache.set(filePath, result);
    return result;
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      rb: 'ruby',
      php: 'php',
      swift: 'swift',
      kt: 'kotlin',
    };
    return languageMap[ext || ''] || 'plaintext';
  }

  private calculateMetrics(content: string, _language: string): CodeMetrics {
    const lines = content.split('\n');
    let linesOfCode = 0;
    let linesOfComments = 0;
    let blankLines = 0;

    let inBlockComment = false;
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (inBlockComment) {
        linesOfComments++;
        if (trimmed.includes('*/')) {
          inBlockComment = false;
        }
        continue;
      }

      if (trimmed === '') {
        blankLines++;
      } else if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('--')) {
        linesOfComments++;
      } else if (trimmed.startsWith('/*') || trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
        linesOfComments++;
        if (!trimmed.includes('*/') && !trimmed.endsWith('"""') && !trimmed.endsWith("'''")) {
          inBlockComment = true;
        }
      } else {
        linesOfCode++;
      }
    }

    const functionMatches = content.match(/function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\(|def\s+\w+|fn\s+\w+/g) || [];
    const classMatches = content.match(/class\s+\w+|struct\s+\w+/g) || [];

    const complexity = this.calculateComplexity(content);

    return {
      linesOfCode,
      linesOfComments,
      blankLines,
      functions: functionMatches.length,
      classes: classMatches.length,
      complexity,
      maintainabilityIndex: Math.max(0, 100 - complexity * 2),
    };
  }

  private calculateComplexity(content: string): number {
    const controlFlowPatterns = [
      /\bif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\bswitch\s*\(/g,
      /\bcase\s+/g,
      /\bcatch\s*\(/g,
      /\?\s*:/g,
      /&&/g,
      /\|\|/g,
    ];

    let complexity = 1;
    for (const pattern of controlFlowPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  private detectIssues(content: string, language: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      if (language === 'typescript' || language === 'javascript') {
        if (line.includes('console.log')) {
          issues.push({
            type: 'warning',
            message: '避免在生产代码中使用 console.log',
            line: lineNum,
            column: line.indexOf('console.log') + 1,
            rule: 'no-console',
            fix: '// 移除或使用日志库',
          });
        }

        if (line.includes('var ')) {
          issues.push({
            type: 'warning',
            message: '使用 let 或 const 替代 var',
            line: lineNum,
            column: line.indexOf('var ') + 1,
            rule: 'no-var',
            fix: line.replace('var ', 'const '),
          });
        }

        if (line.includes('== ') && !line.includes('=== ')) {
          issues.push({
            type: 'warning',
            message: '使用 === 替代 ==',
            line: lineNum,
            column: line.indexOf('== ') + 1,
            rule: 'eqeqeq',
          });
        }
      }

      if (line.length > 120) {
        issues.push({
          type: 'info',
          message: '行长度超过120字符',
          line: lineNum,
          column: 121,
          rule: 'max-len',
        });
      }

      if (line.includes('TODO') || line.includes('FIXME') || line.includes('HACK')) {
        issues.push({
          type: 'info',
          message: `发现待办事项: ${line.trim()}`,
          line: lineNum,
          column: 1,
          rule: 'todo-comment',
        });
      }
    });

    return issues;
  }

  private generateSuggestions(content: string, language: string): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      if (language === 'typescript' || language === 'javascript') {
        if (line.includes('.map(') && line.includes('.filter(')) {
          suggestions.push({
            type: 'optimize',
            message: '考虑合并 map 和 filter 操作以减少迭代次数',
            line: lineNum,
            suggestion: '使用 flatMap 或单次 reduce 操作',
            impact: 'medium',
          });
        }

        if (line.includes('any')) {
          suggestions.push({
            type: 'refactor',
            message: '避免使用 any 类型',
            line: lineNum,
            suggestion: '定义具体的类型接口',
            impact: 'high',
          });
        }

        if (line.includes('eval(')) {
          suggestions.push({
            type: 'security',
            message: 'eval() 存在安全风险',
            line: lineNum,
            suggestion: '使用 JSON.parse 或其他安全替代方案',
            impact: 'high',
          });
        }
      }

      if (line.includes('password') || line.includes('secret') || line.includes('api_key')) {
        suggestions.push({
          type: 'security',
          message: '可能包含敏感信息',
          line: lineNum,
          suggestion: '使用环境变量存储敏感信息',
          impact: 'high',
        });
      }
    });

    return suggestions;
  }

  private extractDependencies(content: string, language: string): string[] {
    const dependencies: string[] = [];

    if (language === 'typescript' || language === 'javascript') {
      const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
      const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

      let match;
      while ((match = importRegex.exec(content)) !== null) {
        dependencies.push(match[1]);
      }
      while ((match = requireRegex.exec(content)) !== null) {
        dependencies.push(match[1]);
      }
    }

    if (language === 'python') {
      const importRegex = /(?:import|from)\s+(\w+)/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        dependencies.push(match[1]);
      }
    }

    return [...new Set(dependencies)];
  }

  async analyzeProject(files: Array<{ path: string; content: string }>): Promise<ProjectAnalysis> {
    let totalLines = 0;
    const languages: Record<string, number> = {};
    const allDependencies: Set<string> = new Set();
    const complexities: number[] = [];
    const maintainabilities: number[] = [];

    for (const file of files) {
      const result = await this.analyzeFile(file.content, file.path);
      totalLines += result.metrics.linesOfCode;
      
      languages[result.language] = (languages[result.language] || 0) + 1;
      
      result.dependencies.forEach(d => allDependencies.add(d));
      complexities.push(result.metrics.complexity);
      maintainabilities.push(result.metrics.maintainabilityIndex);
    }

    const avgComplexity = complexities.length > 0
      ? complexities.reduce((a, b) => a + b, 0) / complexities.length
      : 0;

    const avgMaintainability = maintainabilities.length > 0
      ? maintainabilities.reduce((a, b) => a + b, 0) / maintainabilities.length
      : 0;

    return {
      totalFiles: files.length,
      totalLines,
      languages,
      dependencies: {
        production: Array.from(allDependencies).filter(d => !d.startsWith('.')),
        development: [],
        outdated: [],
        vulnerable: [],
      },
      structure: {
        name: 'root',
        type: 'folder',
        path: '.',
        children: [],
      },
      metrics: {
        averageComplexity: avgComplexity,
        averageMaintainability: avgMaintainability,
        technicalDebt: Math.floor(avgComplexity * 10),
      },
    };
  }

  extractImports(content: string, language: string): ImportInfo[] {
    const imports: ImportInfo[] = [];

    if (language === 'typescript' || language === 'javascript') {
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        const match = line.match(/import\s+(.*?)\s+from\s+['"]([^'"]+)['"]/);
        if (match) {
          const specifiers = match[1]
            .replace(/[{}]/g, '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          
          imports.push({
            source: match[2],
            specifiers,
            line: index + 1,
            isDefault: !match[1].includes('{'),
            isNamespace: match[1].includes('*'),
          });
        }
      });
    }

    return imports;
  }

  extractExports(content: string, language: string): ExportInfo[] {
    const exports: ExportInfo[] = [];

    if (language === 'typescript' || language === 'javascript') {
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        const defaultMatch = line.match(/export\s+default\s+(\w+)/);
        if (defaultMatch) {
          exports.push({
            name: defaultMatch[1],
            type: 'value',
            line: index + 1,
            isDefault: true,
          });
        }

        const namedMatch = line.match(/export\s+(?:const|let|var|function|class)\s+(\w+)/);
        if (namedMatch) {
          const keyword = line.match(/export\s+(const|let|var|function|class)/)?.[1];
          exports.push({
            name: namedMatch[1],
            type: keyword === 'function' ? 'function' : keyword === 'class' ? 'class' : 'value',
            line: index + 1,
            isDefault: false,
          });
        }
      });
    }

    return exports;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const codeAnalysisService = new CodeAnalysisService();
