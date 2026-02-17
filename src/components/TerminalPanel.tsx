import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, X, Trash2, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { realFileService } from '../services/realFileService';

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
    const args = cmd.trim().split(' ').slice(1).join(' ');
    const parts = cmd.trim().split(' ');
    const cmdName = parts[0].toLowerCase();

    const workspace = realFileService.getWorkspace();

    switch (cmdName) {
      case 'ls':
      case 'dir':
        if (!workspace) {
          output = '❌ 没有打开的工作区';
        } else {
          const files = realFileService.listFiles();
          if (files.length === 0) {
            output = '(空目录)';
          } else {
            output = files.map(f => {
              const lines = f.content.split('\n').length;
              return `📄 ${f.path} (${lines} 行)`;
            }).join('\n');
          }
        }
        break;

      case 'cat':
        if (!args) {
          output = '用法: cat <文件名>';
        } else if (!workspace) {
          output = '❌ 没有打开的工作区';
        } else {
          const content = realFileService.readFile(args);
          if (content === null) {
            output = `❌ 文件不存在: ${args}`;
          } else {
            output = content;
          }
        }
        break;

      case 'touch':
      case 'new':
        if (!args) {
          output = '用法: touch <文件名>';
        } else if (!workspace) {
          realFileService.createWorkspace('新项目');
          realFileService.writeFile(args, '');
          output = `✅ 文件已创建: ${args}`;
        } else {
          realFileService.writeFile(args, '');
          output = `✅ 文件已创建: ${args}`;
        }
        break;

      case 'rm':
      case 'del':
        if (!args) {
          output = '用法: rm <文件名>';
        } else if (!workspace) {
          output = '❌ 没有打开的工作区';
        } else {
          const success = realFileService.deleteFile(args);
          if (success) {
            output = `✅ 文件已删除: ${args}`;
          } else {
            output = `❌ 文件不存在: ${args}`;
          }
        }
        break;

      case 'grep':
      case 'search':
        if (!args) {
          output = '用法: grep <搜索词>';
        } else if (!workspace) {
          output = '❌ 没有打开的工作区';
        } else {
          const results = realFileService.searchInFiles(args);
          if (results.length === 0) {
            output = `未找到匹配: ${args}`;
          } else {
            output = results.slice(0, 20).map(r => 
              `${r.path}:${r.line} - ${r.content.slice(0, 60)}`
            ).join('\n');
            if (results.length > 20) {
              output += `\n... 还有 ${results.length - 20} 个结果`;
            }
          }
        }
        break;

      case 'pwd':
        if (!workspace) {
          output = '❌ 没有打开的工作区';
        } else {
          output = `📁 ${workspace.name} (${workspace.files.size} 个文件)`;
        }
        break;

      case 'help':
        output = `可用命令:
  ls, dir       - 列出当前工作区文件
  cat <file>    - 查看文件内容
  touch <file>  - 创建新文件
  rm <file>     - 删除文件
  grep <term>   - 搜索文件内容
  pwd           - 显示当前工作区信息
  node <code>   - 执行 JavaScript 代码 (浏览器环境)
  clear, cls    - 清空终端
  help          - 显示此帮助

注意: 
- 文件操作仅在当前浏览器工作区生效
- 系统命令 (npm, git, python) 需要本地环境支持，暂不可用`;
        break;

      case 'clear':
      case 'cls':
        setTerminalOutput('');
        return;

      case 'npm':
      case 'yarn':
      case 'pnpm':
        output = `⚠️ 浏览器环境限制

无法直接执行 ${cmdName} 命令。

替代方案:
- 使用小码酱的自动执行功能
- 在本地终端执行命令
- 使用 /terminal 命令查看更多`;
        break;

      case 'git':
        output = `⚠️ 浏览器环境限制

无法直接执行 git 命令。

替代方案:
- 使用小码酱的自动执行功能
- 在本地终端执行 git 命令`;
        break;

      case 'node':
        if (args) {
          try {
            const code = args;
            let result: unknown;
            try {
              const fn = new Function(`"use strict"; return (${code});`);
              result = fn();
            } catch {
              const fn = new Function(`"use strict"; ${code}`);
              result = fn();
            }
            output = `> ${code}\n${JSON.stringify(result, null, 2)}`;
          } catch (e) {
            output = `❌ 执行错误: ${e instanceof Error ? e.message : String(e)}`;
          }
        } else {
          output = '用法: node <代码>';
        }
        break;

      default:
        output = `❌ 未知命令: ${cmdName}\n输入 'help' 查看可用命令`;
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
          {realFileService.hasWorkspace() && (
            <span className="text-xs text-lcs-secondary">
              📁 {realFileService.getWorkspace()?.name}
            </span>
          )}
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
          小码酱终端 v1.0 - 输入 'help' 查看可用命令
        </div>
        {!realFileService.hasWorkspace() && (
          <div className="flex items-center gap-2 text-yellow-400 text-xs mb-2">
            <AlertCircle className="w-3 h-3" />
            <span>没有打开的工作区 - 文件操作命令将不可用</span>
          </div>
        )}
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
