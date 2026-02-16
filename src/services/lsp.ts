import * as monaco from 'monaco-editor';

export interface LSPDiagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity: 'error' | 'warning' | 'information' | 'hint';
  message: string;
  source?: string;
}

export interface LSPCompletion {
  label: string;
  kind: 'function' | 'variable' | 'class' | 'method' | 'property' | 'keyword' | 'snippet';
  detail?: string;
  documentation?: string;
  insertText: string;
}

export interface LSPHover {
  contents: string | string[];
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface LSPDefinition {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export type LSPSeverity = monaco.MarkerSeverity;

export class LSPService {
  private diagnostics: Map<string, LSPDiagnostic[]> = new Map();
  private completions: Map<string, LSPCompletion[]> = new Map();
  private enabled: boolean = true;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setDiagnostics(uri: string, diagnostics: LSPDiagnostic[]) {
    this.diagnostics.set(uri, diagnostics);
    this.publishDiagnostics(uri);
  }

  getDiagnostics(uri: string): LSPDiagnostic[] {
    return this.diagnostics.get(uri) || [];
  }

  private publishDiagnostics(uri: string) {
    const diagnostics = this.diagnostics.get(uri) || [];
    const markers: monaco.editor.IMarkerData[] = diagnostics.map(d => ({
      severity: this.mapSeverity(d.severity),
      message: d.message,
      startLineNumber: d.range.start.line + 1,
      startColumn: d.range.start.character + 1,
      endLineNumber: d.range.end.line + 1,
      endColumn: d.range.end.character + 1,
      source: d.source,
    }));

    const model = monaco.editor.getModels().find(m => m.uri.toString() === uri);
    if (model) {
      monaco.editor.setModelMarkers(model, 'lcs-lsp', markers);
    }
  }

  private mapSeverity(severity: LSPDiagnostic['severity']): monaco.MarkerSeverity {
    switch (severity) {
      case 'error':
        return monaco.MarkerSeverity.Error;
      case 'warning':
        return monaco.MarkerSeverity.Warning;
      case 'information':
        return monaco.MarkerSeverity.Info;
      case 'hint':
        return monaco.MarkerSeverity.Hint;
      default:
        return monaco.MarkerSeverity.Info;
    }
  }

  setCompletions(language: string, completions: LSPCompletion[]) {
    this.completions.set(language, completions);
  }

  getCompletions(language: string): LSPCompletion[] {
    return this.completions.get(language) || [];
  }

  async requestCompletion(uri: string, position: { line: number; character: number }): Promise<LSPCompletion[]> {
    const model = monaco.editor.getModels().find(m => m.uri.toString() === uri);
    if (!model) return [];

    const language = model.getLanguageId();
    const baseCompletions = this.getCompletions(language);
    
    const word = model.getWordAtPosition({
      lineNumber: position.line + 1,
      column: position.character + 1,
    });

    if (!word) return baseCompletions;

    return baseCompletions.filter(c => 
      c.label.toLowerCase().includes(word.word.toLowerCase())
    );
  }

  async requestHover(uri: string, position: { line: number; character: number }): Promise<LSPHover | null> {
    const model = monaco.editor.getModels().find(m => m.uri.toString() === uri);
    if (!model) return null;

    const word = model.getWordAtPosition({
      lineNumber: position.line + 1,
      column: position.character + 1,
    });

    if (!word) return null;

    const completions = this.getCompletions(model.getLanguageId());
    const match = completions.find(c => c.label === word.word);

    if (match && match.documentation) {
      return {
        contents: [match.detail || '', match.documentation].filter(Boolean),
      };
    }

    return null;
  }

  async requestDefinition(_uri: string, _position: { line: number; character: number }): Promise<LSPDefinition[]> {
    return [];
  }

  async requestReferences(_uri: string, _position: { line: number; character: number }): Promise<LSPDefinition[]> {
    return [];
  }

  clearDiagnostics(uri: string) {
    this.diagnostics.delete(uri);
    const model = monaco.editor.getModels().find(m => m.uri.toString() === uri);
    if (model) {
      monaco.editor.setModelMarkers(model, 'lcs-lsp', []);
    }
  }

  clearAll() {
    this.diagnostics.clear();
    monaco.editor.getModels().forEach(model => {
      monaco.editor.setModelMarkers(model, 'lcs-lsp', []);
    });
  }
}

export const lspService = new LSPService();

export const TYPESCRIPT_COMPLETIONS: LSPCompletion[] = [
  { label: 'console', kind: 'variable', detail: 'console', insertText: 'console', documentation: '控制台对象' },
  { label: 'log', kind: 'method', detail: 'console.log()', insertText: 'log(${1:value})', documentation: '输出到控制台' },
  { label: 'function', kind: 'keyword', insertText: 'function ${1:name}(${2:params}) {\n\t${3}\n}' },
  { label: 'const', kind: 'keyword', insertText: 'const ${1:name} = ${2:value};' },
  { label: 'let', kind: 'keyword', insertText: 'let ${1:name} = ${2:value};' },
  { label: 'if', kind: 'keyword', insertText: 'if (${1:condition}) {\n\t${2}\n}' },
  { label: 'else', kind: 'keyword', insertText: 'else {\n\t${1}\n}' },
  { label: 'for', kind: 'keyword', insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:length}; ${1:i}++) {\n\t${3}\n}' },
  { label: 'while', kind: 'keyword', insertText: 'while (${1:condition}) {\n\t${2}\n}' },
  { label: 'return', kind: 'keyword', insertText: 'return ${1:value};' },
  { label: 'import', kind: 'keyword', insertText: "import { ${2:module} } from '${1:package}';" },
  { label: 'export', kind: 'keyword', insertText: 'export ${1:declaration};' },
  { label: 'class', kind: 'keyword', insertText: 'class ${1:Name} {\n\t${2}\n}' },
  { label: 'interface', kind: 'keyword', insertText: 'interface ${1:Name} {\n\t${2}\n}' },
  { label: 'type', kind: 'keyword', insertText: 'type ${1:Name} = ${2:definition};' },
  { label: 'async', kind: 'keyword', insertText: 'async ' },
  { label: 'await', kind: 'keyword', insertText: 'await ${1:promise}' },
  { label: 'try', kind: 'keyword', insertText: 'try {\n\t${1}\n} catch (${2:error}) {\n\t${3}\n}' },
  { label: 'throw', kind: 'keyword', insertText: 'throw new Error(${1:message});' },
  { label: 'useState', kind: 'function', detail: 'React.useState', insertText: "const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState(${2:initialValue});", documentation: 'React状态钩子' },
  { label: 'useEffect', kind: 'function', detail: 'React.useEffect', insertText: 'useEffect(() => {\n\t${1}\n\treturn () => {\n\t\t${2}\n\t};\n}, [${3:deps}]);', documentation: 'React副作用钩子' },
  { label: 'useCallback', kind: 'function', detail: 'React.useCallback', insertText: 'useCallback(() => {\n\t${1}\n}, [${2:deps}]);', documentation: 'React回调缓存钩子' },
  { label: 'useMemo', kind: 'function', detail: 'React.useMemo', insertText: 'useMemo(() => {\n\treturn ${1:value};\n}, [${2:deps}]);', documentation: 'React值缓存钩子' },
  { label: 'useRef', kind: 'function', detail: 'React.useRef', insertText: 'const ${1:ref} = useRef(${2:initialValue});', documentation: 'React引用钩子' },
];

export const PYTHON_COMPLETIONS: LSPCompletion[] = [
  { label: 'def', kind: 'keyword', insertText: 'def ${1:function_name}(${2:params}):\n\t${3}' },
  { label: 'class', kind: 'keyword', insertText: 'class ${1:ClassName}:\n\tdef __init__(self):\n\t\t${2}' },
  { label: 'import', kind: 'keyword', insertText: 'import ${1:module}' },
  { label: 'from', kind: 'keyword', insertText: "from ${1:module} import ${2:name}" },
  { label: 'if', kind: 'keyword', insertText: 'if ${1:condition}:\n\t${2}' },
  { label: 'elif', kind: 'keyword', insertText: 'elif ${1:condition}:\n\t${2}' },
  { label: 'else', kind: 'keyword', insertText: 'else:\n\t${1}' },
  { label: 'for', kind: 'keyword', insertText: 'for ${1:item} in ${2:iterable}:\n\t${3}' },
  { label: 'while', kind: 'keyword', insertText: 'while ${1:condition}:\n\t${2}' },
  { label: 'return', kind: 'keyword', insertText: 'return ${1:value}' },
  { label: 'print', kind: 'function', detail: 'print()', insertText: 'print(${1:value})', documentation: '输出到控制台' },
  { label: 'lambda', kind: 'keyword', insertText: 'lambda ${1:params}: ${2:expression}' },
  { label: 'try', kind: 'keyword', insertText: 'try:\n\t${1}\nexcept ${2:Exception} as e:\n\t${3}' },
  { label: 'with', kind: 'keyword', insertText: 'with ${1:context} as ${2:alias}:\n\t${3}' },
  { label: 'async', kind: 'keyword', insertText: 'async def ${1:function_name}(${2:params}):\n\t${3}' },
  { label: 'await', kind: 'keyword', insertText: 'await ${1:coroutine}' },
];

export function initializeDefaultCompletions() {
  lspService.setCompletions('typescript', TYPESCRIPT_COMPLETIONS);
  lspService.setCompletions('javascript', TYPESCRIPT_COMPLETIONS);
  lspService.setCompletions('python', PYTHON_COMPLETIONS);
}
