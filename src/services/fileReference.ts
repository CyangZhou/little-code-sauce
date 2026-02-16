export interface FileReference {
  type: 'file' | 'folder' | 'code';
  path: string;
  content?: string;
  language?: string;
  lineRange?: { start: number; end: number };
}

export interface ParsedReference {
  references: FileReference[];
  remainingText: string;
}

const LANGUAGE_MAP: Record<string, string> = {
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
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  r: 'r',
  sql: 'sql',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  ps1: 'powershell',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  html: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  md: 'markdown',
  markdown: 'markdown',
  txt: 'plaintext',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  toml: 'toml',
  ini: 'ini',
  env: 'dotenv',
};

export function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return LANGUAGE_MAP[ext] || 'plaintext';
}

export function parseFileReferences(input: string): ParsedReference {
  const referenceRegex = /@([^\s@]+)/g;
  const references: FileReference[] = [];
  let match;
  let remainingText = input;

  while ((match = referenceRegex.exec(input)) !== null) {
    const refPath = match[1];
    const isFolder = !refPath.includes('.') || refPath.endsWith('/');
    
    references.push({
      type: isFolder ? 'folder' : 'file',
      path: refPath,
      language: isFolder ? undefined : getLanguageFromPath(refPath),
    });
  }

  remainingText = input.replace(referenceRegex, '').trim();

  return { references, remainingText };
}

export function formatReferenceForPrompt(ref: FileReference, content: string): string {
  if (ref.type === 'folder') {
    return `[文件夹: ${ref.path}]\n${content}\n`;
  }

  const lang = ref.language || 'plaintext';
  return `[文件: ${ref.path}]\n\`\`\`${lang}\n${content}\n\`\`\`\n`;
}

export function formatAllReferencesForPrompt(references: FileReference[], contents: Map<string, string>): string {
  if (references.length === 0) return '';

  const formatted = references
    .map(ref => {
      const content = contents.get(ref.path);
      if (content) {
        return formatReferenceForPrompt(ref, content);
      }
      return `[${ref.type === 'folder' ? '文件夹' : '文件'}: ${ref.path}] (未找到)\n`;
    })
    .join('\n');

  return `\n--- 引用的文件 ---\n${formatted}--- 引用结束 ---\n\n`;
}

export function extractCodeLineRange(ref: string): { path: string; start?: number; end?: number } {
  const lineRangeMatch = ref.match(/^(.+?)(?::(\d+)(?:-(\d+))?)?$/);
  
  if (!lineRangeMatch) {
    return { path: ref };
  }

  const path = lineRangeMatch[1];
  const start = lineRangeMatch[2] ? parseInt(lineRangeMatch[2], 10) : undefined;
  const end = lineRangeMatch[3] ? parseInt(lineRangeMatch[3], 10) : start;

  return { path, start, end };
}

export function getFileSuggestions(
  input: string,
  availableFiles: string[]
): { path: string; type: 'file' | 'folder' }[] {
  const atIndex = input.lastIndexOf('@');
  if (atIndex === -1) return [];

  const partial = input.slice(atIndex + 1).toLowerCase();
  
  return availableFiles
    .filter(f => f.toLowerCase().includes(partial))
    .slice(0, 10)
    .map(path => ({
      path,
      type: path.includes('.') ? 'file' : 'folder',
    }));
}

export function createReferenceContext(
  references: FileReference[],
  fileContents: Map<string, string>
): string {
  if (references.length === 0) return '';

  const contextParts: string[] = ['以下是用户引用的文件内容:'];

  references.forEach(ref => {
    const content = fileContents.get(ref.path);
    if (content) {
      contextParts.push(`\n### ${ref.path}`);
      contextParts.push(`\`\`\`${ref.language || 'plaintext'}`);
      contextParts.push(content);
      contextParts.push('`\`\`');
    } else {
      contextParts.push(`\n### ${ref.path} (文件未找到)`);
    }
  });

  return contextParts.join('\n');
}

export class FileReferenceManager {
  private fileCache: Map<string, string> = new Map();
  private projectFiles: string[] = [];

  setProjectFiles(files: string[]) {
    this.projectFiles = files;
  }

  getProjectFiles(): string[] {
    return this.projectFiles;
  }

  cacheFile(path: string, content: string) {
    this.fileCache.set(path, content);
  }

  getCachedFile(path: string): string | undefined {
    return this.fileCache.get(path);
  }

  clearCache() {
    this.fileCache.clear();
  }

  resolveReferences(references: FileReference[]): Map<string, string> {
    const contents = new Map<string, string>();
    
    references.forEach(ref => {
      const cached = this.fileCache.get(ref.path);
      if (cached) {
        contents.set(ref.path, cached);
      }
    });

    return contents;
  }

  getSuggestions(input: string): { path: string; type: 'file' | 'folder' }[] {
    return getFileSuggestions(input, this.projectFiles);
  }
}

export const fileReferenceManager = new FileReferenceManager();
