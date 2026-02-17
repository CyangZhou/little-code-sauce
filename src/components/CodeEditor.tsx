import React, { useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { X, FileCode, Play, Copy, Download, Save } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { realFileService } from '../services/realFileService';

interface CodeEditorProps {
  onExecute?: (code: string, language: string) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ onExecute }) => {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const { editor, updateFileContent, closeFile, setActiveFile } = useAppStore();

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
  };

  const loadFileContent = useCallback((filePath: string) => {
    const content = realFileService.readFile(filePath);
    if (content !== null && editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        model.setValue(content);
        updateFileContent(filePath, content);
      }
    }
  }, [updateFileContent]);

  useEffect(() => {
    if (editor.activeFile) {
      loadFileContent(editor.activeFile);
    }
  }, [editor.activeFile, loadFileContent]);

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

  const handleSave = () => {
    if (editor.activeFile) {
      const content = editor.fileContents[editor.activeFile] || '';
      realFileService.writeFile(editor.activeFile, content);
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

  const handleDownload = () => {
    if (editor.activeFile) {
      const content = editor.fileContents[editor.activeFile] || '';
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = editor.activeFile.split('/').pop() || 'file';
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

  const handleCloseFile = (file: string, e: React.MouseEvent) => {
    e.stopPropagation();
    closeFile(file);
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
            或者在文件浏览器中点击文件开始编辑。
          </p>
          {!realFileService.hasWorkspace() && (
            <p className="text-lcs-primary text-sm mt-4">
              💡 请先创建或打开一个项目
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-lcs-border bg-lcs-surface/50">
        <div className="flex items-center gap-2 overflow-x-auto flex-1">
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
              <span className="max-w-[120px] truncate">{file.split('/').pop()}</span>
              <span
                onClick={(e) => handleCloseFile(file, e)}
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
            title="保存文件"
          >
            <Save className="w-4 h-4" />
          </button>
          <button
            onClick={handleDownload}
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

      <div className="px-4 py-1 border-t border-lcs-border bg-lcs-surface/30 text-xs text-lcs-muted flex items-center justify-between">
        <span>{editor.activeFile}</span>
        <span>{getLanguage(editor.activeFile)}</span>
      </div>
    </div>
  );
};
