import React, { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';
import { X, FileCode, Play, Copy, Download } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface CodeEditorProps {
  onExecute?: (code: string, language: string) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ onExecute }) => {
  const editorRef = useRef<any>(null);
  const { editor, updateFileContent, closeFile, setActiveFile } = useAppStore();

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
  };

  useEffect(() => {
    if (editorRef.current && editor.activeFile) {
      const model = editorRef.current.getModel();
      const currentContent = editorRef.current.getValue();
      const storedContent = editor.fileContents[editor.activeFile];
      if (model && storedContent !== undefined && currentContent !== storedContent) {
        model.setValue(storedContent);
      }
    }
  }, [editor.activeFile, editor.fileContents]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && editor.activeFile) {
      updateFileContent(editor.activeFile, value);
    }
  };

  const getLanguage = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
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
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      html: 'html',
      css: 'css',
      scss: 'scss',
      sql: 'sql',
      sh: 'shell',
      bash: 'shell',
    };
    return langMap[ext || ''] || 'plaintext';
  };

  const handleExecute = () => {
    if (editor.activeFile && onExecute) {
      const content = editor.fileContents[editor.activeFile] || '';
      const language = getLanguage(editor.activeFile);
      onExecute(content, language);
    }
  };

  const handleSave = () => {
    if (editor.activeFile) {
      const content = editor.fileContents[editor.activeFile] || '';
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = editor.activeFile;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleCopy = async () => {
    if (editor.activeFile) {
      const content = editor.fileContents[editor.activeFile] || '';
      await navigator.clipboard.writeText(content);
    }
  };

  if (!editor.activeFile) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-lcs-bg/50">
        <div className="text-center">
          <FileCode className="w-16 h-16 text-lcs-muted mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-lcs-text mb-2">代码编辑器</h3>
          <p className="text-lcs-muted max-w-sm">
            在聊天中生成代码后，点击"在编辑器中打开"按钮，
            <br />
            或者创建新文件开始编写。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-lcs-border bg-lcs-surface/50">
        <div className="flex items-center gap-2 overflow-x-auto">
          {editor.openFiles.map((file) => (
            <button
              key={file}
              onClick={() => setActiveFile(file)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                file === editor.activeFile
                  ? 'bg-lcs-primary/20 text-lcs-primary border border-lcs-primary/30'
                  : 'text-lcs-muted hover:text-lcs-text hover:bg-lcs-surface'
              }`}
            >
              <FileCode className="w-3 h-3" />
              {file}
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(file);
                }}
                className="ml-1 hover:bg-white/10 rounded p-0.5"
              >
                <X className="w-3 h-3" />
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-2 hover:bg-lcs-surface rounded-lg text-lcs-muted hover:text-lcs-text transition-colors"
            title="复制代码"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            className="p-2 hover:bg-lcs-surface rounded-lg text-lcs-muted hover:text-lcs-text transition-colors"
            title="下载文件"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleExecute}
            className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-lcs-primary to-lcs-secondary rounded-lg text-white text-sm hover:opacity-90 transition-opacity"
          >
            <Play className="w-4 h-4" />
            执行
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={getLanguage(editor.activeFile)}
          value={editor.fileContents[editor.activeFile] || ''}
          theme="vs-dark"
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 2,
            renderWhitespace: 'selection',
            bracketPairColorization: { enabled: true },
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            padding: { top: 16, bottom: 16 },
            lineNumbers: 'on',
            folding: true,
            foldingHighlight: true,
            showFoldingControls: 'mouseover',
            matchBrackets: 'always',
            autoIndent: 'full',
            formatOnPaste: true,
            formatOnType: true,
          }}
        />
      </div>
    </div>
  );
};
