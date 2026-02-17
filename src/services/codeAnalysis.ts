import { realFileService } from './realFileService';

export interface CodeSymbol {
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'import' | 'export' | 'const';
  line: number;
  endLine?: number;
  signature?: string;
  documentation?: string;
}

export interface CodeIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  rule?: string;
}

export interface CodeAnalysisResult {
  language: string;
  symbols: CodeSymbol[];
  issues: CodeIssue[];
  complexity: {
    cyclomatic: number;
    cognitive: number;
    linesOfCode: number;
  };
  imports: string[];
  exports: string[];
  dependencies: string[];
}

const LANGUAGE_PATTERNS: Record<string, {
  function: RegExp[];
  class: RegExp[];
  interface: RegExp[];
  variable: RegExp[];
  import: RegExp[];
  export: RegExp[];
  comment: RegExp[];
}> = {
  typescript: {
    function: [
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm,
      /^(?:export\s+)?(?:async\s+)?(\w+)\s*(?:<[^>]+>)?\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/gm,
      /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>/gm,
    ],
    class: [
      /^(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/gm,
    ],
    interface: [
      /^(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+[\w,\s]+)?\s*\{/gm,
    ],
    variable: [
      /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=;]+)?\s*=/gm,
    ],
    import: [
      /^import\s+(?:\{[^}]+\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/gm,
      /^import\s+['"]([^'"]+)['"]/gm,
    ],
    export: [
      /^export\s+(?:default\s+)?(?:function|class|interface|const|let|var)\s+(\w+)/gm,
      /^export\s+\{([^}]+)\}/gm,
    ],
    comment: [
      /\/\/.*$/gm,
      /\/\*[\s\S]*?\*\//gm,
    ],
  },
  javascript: {
    function: [
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm,
      /^(?:export\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/gm,
      /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>/gm,
    ],
    class: [
      /^(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?\s*\{/gm,
    ],
    interface: [],
    variable: [
      /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=/gm,
    ],
    import: [
      /^import\s+(?:\{[^}]+\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/gm,
      /^import\s+['"]([^'"]+)['"]/gm,
    ],
    export: [
      /^export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/gm,
      /^export\s+\{([^}]+)\}/gm,
    ],
    comment: [
      /\/\/.*$/gm,
      /\/\*[\s\S]*?\*\//gm,
    ],
  },
  python: {
    function: [
      /^(?:async\s+)?def\s+(\w+)\s*\(/gm,
    ],
    class: [
      /^class\s+(\w+)(?:\([^)]*\))?\s*:/gm,
    ],
    interface: [],
    variable: [
      /^(\w+)\s*=\s*(?!==)/gm,
    ],
    import: [
      /^import\s+([\w.]+)/gm,
      /^from\s+([\w.]+)\s+import/gm,
    ],
    export: [],
    comment: [
      /#.*$/gm,
      /"""[\s\S]*?"""/gm,
      /'''[\s\S]*?'''/gm,
    ],
  },
};

function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
  };
  return langMap[ext || ''] || 'javascript';
}

function stripComments(code: string, patterns: RegExp[]): string {
  let result = code;
  for (const pattern of patterns) {
    result = result.replace(pattern, '');
  }
  return result;
}

function countLines(code: string): number {
  return code.split('\n').filter(line => line.trim().length > 0).length;
}

function calculateCyclomaticComplexity(code: string): number {
  const controlFlowPatterns = [
    /\bif\b/g,
    /\belse\s+if\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bswitch\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\?\s*:/g,
    /&&/g,
    /\|\|/g,
  ];
  
  let complexity = 1;
  for (const pattern of controlFlowPatterns) {
    const matches = code.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }
  return complexity;
}

function calculateCognitiveComplexity(code: string): number {
  const lines = code.split('\n');
  let complexity = 0;
  let nestingLevel = 0;
  
  const nestingPatterns = [
    { pattern: /\bif\b/, increment: 1 },
    { pattern: /\bfor\b/, increment: 1 },
    { pattern: /\bwhile\b/, increment: 1 },
    { pattern: /\bswitch\b/, increment: 1 },
    { pattern: /\bcatch\b/, increment: 1 },
    { pattern: /\bfunction\b/, increment: 1 },
    { pattern: /\b=>\s*\{/, increment: 1 },
  ];
  
  const closingPatterns = [
    /^\s*\}/,
  ];
  
  for (const line of lines) {
    for (const { pattern, increment } of nestingPatterns) {
      if (pattern.test(line)) {
        complexity += (nestingLevel + 1) * increment;
        nestingLevel += increment;
      }
    }
    
    for (const pattern of closingPatterns) {
      if (pattern.test(line)) {
        nestingLevel = Math.max(0, nestingLevel - 1);
      }
    }
  }
  
  return complexity;
}

function findSymbols(code: string, language: string): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const patterns = LANGUAGE_PATTERNS[language] || LANGUAGE_PATTERNS.javascript;
  const lines = code.split('\n');
  
  const findMatches = (regexList: RegExp[], type: CodeSymbol['type']) => {
    for (const pattern of regexList) {
      let match;
      const globalPattern = new RegExp(pattern.source, pattern.flags);
      while ((match = globalPattern.exec(code)) !== null) {
        const lineNumber = code.substring(0, match.index).split('\n').length;
        const lineContent = lines[lineNumber - 1]?.trim() || '';
        
        symbols.push({
          name: match[1] || 'anonymous',
          type,
          line: lineNumber,
          signature: lineContent.slice(0, 100),
        });
      }
    }
  };
  
  findMatches(patterns.function, 'function');
  findMatches(patterns.class, 'class');
  findMatches(patterns.interface, 'interface');
  findMatches(patterns.variable, 'variable');
  
  return symbols.sort((a, b) => a.line - b.line);
}

function findIssues(code: string, language: string): CodeIssue[] {
  const issues: CodeIssue[] = [];
  const lines = code.split('\n');
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    if (line.includes('console.log')) {
      issues.push({
        type: 'warning',
        message: '避免在生产代码中使用 console.log',
        line: lineNum,
        rule: 'no-console',
      });
    }
    
    if (line.includes('any') && language === 'typescript') {
      issues.push({
        type: 'warning',
        message: '避免使用 any 类型',
        line: lineNum,
        rule: 'no-explicit-any',
      });
    }
    
    if (line.includes('TODO') || line.includes('FIXME')) {
      issues.push({
        type: 'info',
        message: '发现待办事项',
        line: lineNum,
        rule: 'todo-comment',
      });
    }
    
    if (line.includes('var ') && (language === 'typescript' || language === 'javascript')) {
      issues.push({
        type: 'warning',
        message: '建议使用 const 或 let 替代 var',
        line: lineNum,
        rule: 'no-var',
      });
    }
    
    if (line.includes('==') && !line.includes('===')) {
      issues.push({
        type: 'warning',
        message: '建议使用严格相等 ===',
        line: lineNum,
        rule: 'eqeqeq',
      });
    }
    
    if (line.trim().length > 120) {
      issues.push({
        type: 'info',
        message: '行长度超过120字符',
        line: lineNum,
        rule: 'max-line-length',
      });
    }
  });
  
  return issues;
}

function findImports(code: string, language: string): string[] {
  const imports: string[] = [];
  const patterns = LANGUAGE_PATTERNS[language] || LANGUAGE_PATTERNS.javascript;
  
  for (const pattern of patterns.import) {
    let match;
    const globalPattern = new RegExp(pattern.source, pattern.flags);
    while ((match = globalPattern.exec(code)) !== null) {
      if (match[1]) {
        imports.push(match[1]);
      }
    }
  }
  
  return [...new Set(imports)];
}

function findExports(code: string, language: string): string[] {
  const exports: string[] = [];
  const patterns = LANGUAGE_PATTERNS[language] || LANGUAGE_PATTERNS.javascript;
  
  for (const pattern of patterns.export) {
    let match;
    const globalPattern = new RegExp(pattern.source, pattern.flags);
    while ((match = globalPattern.exec(code)) !== null) {
      if (match[1]) {
        if (match[1].includes(',')) {
          exports.push(...match[1].split(',').map(s => s.trim()));
        } else {
          exports.push(match[1]);
        }
      }
    }
  }
  
  return [...new Set(exports)];
}

class CodeAnalysisService {
  analyzeFile(path: string): CodeAnalysisResult | null {
    const content = realFileService.readFile(path);
    if (content === null) {
      return null;
    }
    
    return this.analyzeCode(content, path);
  }

  analyzeCode(code: string, filename: string): CodeAnalysisResult {
    const language = detectLanguage(filename);
    const patterns = LANGUAGE_PATTERNS[language] || LANGUAGE_PATTERNS.javascript;
    
    const codeWithoutComments = stripComments(code, patterns.comment);
    
    return {
      language,
      symbols: findSymbols(codeWithoutComments, language),
      issues: findIssues(code, language),
      complexity: {
        cyclomatic: calculateCyclomaticComplexity(codeWithoutComments),
        cognitive: calculateCognitiveComplexity(codeWithoutComments),
        linesOfCode: countLines(code),
      },
      imports: findImports(code, language),
      exports: findExports(code, language),
      dependencies: findImports(code, language),
    };
  }

  analyzeWorkspace(): Map<string, CodeAnalysisResult> {
    const results = new Map<string, CodeAnalysisResult>();
    
    if (!realFileService.hasWorkspace()) {
      return results;
    }
    
    const files = realFileService.listFiles();
    
    for (const file of files) {
      const ext = file.path.split('.').pop()?.toLowerCase();
      if (['ts', 'tsx', 'js', 'jsx', 'py'].includes(ext || '')) {
        const result = this.analyzeFile(file.path);
        if (result) {
          results.set(file.path, result);
        }
      }
    }
    
    return results;
  }

  getSymbols(path: string): CodeSymbol[] {
    const result = this.analyzeFile(path);
    return result?.symbols || [];
  }

  getIssues(path: string): CodeIssue[] {
    const result = this.analyzeFile(path);
    return result?.issues || [];
  }

  getComplexity(path: string): { cyclomatic: number; cognitive: number; linesOfCode: number } | null {
    const result = this.analyzeFile(path);
    return result?.complexity || null;
  }

  findDefinition(symbolName: string): { path: string; line: number } | null {
    if (!realFileService.hasWorkspace()) {
      return null;
    }
    
    const files = realFileService.listFiles();
    
    for (const file of files) {
      const symbols = this.getSymbols(file.path);
      const found = symbols.find(s => s.name === symbolName);
      if (found) {
        return { path: file.path, line: found.line };
      }
    }
    
    return null;
  }

  findReferences(symbolName: string): { path: string; line: number; content: string }[] {
    const results: { path: string; line: number; content: string }[] = [];
    
    if (!realFileService.hasWorkspace()) {
      return results;
    }
    
    const files = realFileService.listFiles();
    
    for (const file of files) {
      const lines = file.content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes(symbolName)) {
          results.push({
            path: file.path,
            line: idx + 1,
            content: line.trim(),
          });
        }
      });
    }
    
    return results;
  }

  getDependencyGraph(): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    const analysis = this.analyzeWorkspace();
    
    analysis.forEach((result, path) => {
      graph.set(path, result.dependencies);
    });
    
    return graph;
  }

  getSummary(): {
    totalFiles: number;
    totalSymbols: number;
    totalIssues: number;
    averageComplexity: number;
  } {
    const analysis = this.analyzeWorkspace();
    let totalSymbols = 0;
    let totalIssues = 0;
    let totalComplexity = 0;
    
    analysis.forEach(result => {
      totalSymbols += result.symbols.length;
      totalIssues += result.issues.length;
      totalComplexity += result.complexity.cyclomatic;
    });
    
    return {
      totalFiles: analysis.size,
      totalSymbols,
      totalIssues,
      averageComplexity: analysis.size > 0 ? totalComplexity / analysis.size : 0,
    };
  }
}

export const codeAnalysisService = new CodeAnalysisService();
