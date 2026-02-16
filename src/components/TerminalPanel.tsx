import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, X, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export const TerminalPanel: React.FC = () => {
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const {
    terminal,
    toggleTerminal,
    addTerminalHistory,
    setTerminalOutput,
  } = useAppStore();

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminal.output]);

  useEffect(() => {
    if (terminal.visible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [terminal.visible]);

  const executeCommand = (cmd: string) => {
    if (!cmd.trim()) return;

    addTerminalHistory(cmd);
    const timestamp = new Date().toLocaleTimeString();
    
    let output = '';
    const command = cmd.trim().toLowerCase();
    const args = cmd.trim().split(' ').slice(1).join(' ');

    if (command.startsWith('ls') || command.startsWith('dir')) {
      output = `node_modules/  src/  public/  dist/  package.json  tsconfig.json  vite.config.ts`;
    } else if (command.startsWith('cat ')) {
      output = `[文件内容预览]\n// ${args} 的内容将在编辑器中显示`;
    } else if (command.startsWith('npm ')) {
      output = `> npm ${args}\n\n✓ 命令已加入队列\n提示: 实际执行需要后端支持`;
    } else if (command.startsWith('git ')) {
      output = `> git ${args}\n\n✓ Git 命令模拟执行\n提示: 实际执行需要后端支持`;
    } else if (command === 'clear' || command === 'cls') {
      setTerminalOutput('');
      return;
    } else if (command === 'help') {
      output = `可用命令:
  ls, dir      - 列出文件
  cat <file>   - 查看文件
  npm <cmd>    - NPM 命令
  git <cmd>    - Git 命令
  clear, cls   - 清空终端
  help         - 显示帮助`;
    } else {
      output = `命令未识别: ${cmd}\n输入 'help' 查看可用命令`;
    }

    const newOutput = `[${timestamp}] $ ${cmd}\n${output}\n\n`;
    setTerminalOutput(terminal.output + newOutput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand(input);
      setInput('');
      setHistoryIndex(-1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (terminal.history.length > 0) {
        const newIndex = historyIndex < terminal.history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(terminal.history[terminal.history.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(terminal.history[terminal.history.length - 1 - newIndex] || '');
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'Escape') {
      toggleTerminal();
    }
  };

  if (!terminal.visible) return null;

  return (
    <div className="h-64 bg-lcs-surface border-t border-lcs-border flex flex-col">
      <div className="h-8 bg-lcs-surface/50 border-b border-lcs-border flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-lcs-primary" />
          <span className="text-xs text-lcs-muted">终端</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTerminalOutput('')}
            className="p-1 hover:bg-lcs-primary/20 rounded text-lcs-muted hover:text-lcs-text transition-colors"
            title="清空"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button
            onClick={toggleTerminal}
            className="p-1 hover:bg-lcs-primary/20 rounded text-lcs-muted hover:text-lcs-text transition-colors"
            title="关闭"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-sm"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="text-lcs-muted text-xs mb-2">
          小码酱终端 v0.1.0 - 输入 'help' 查看可用命令
        </div>
        <pre className="text-lcs-text whitespace-pre-wrap">{terminal.output}</pre>
      </div>

      <div className="h-10 border-t border-lcs-border flex items-center px-3">
        <span className="text-lcs-primary mr-2">$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入命令..."
          className="flex-1 bg-transparent border-none outline-none text-lcs-text placeholder-lcs-muted font-mono text-sm"
        />
      </div>
    </div>
  );
};
