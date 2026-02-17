import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, Sparkles, User, Bot, Copy, Check, Play, Code2, AtSign, Slash, Loader2, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Zap, FolderOpen, FileText } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { Message } from '../store/useAppStore';
import { extractCodeBlocks } from '../core/soul';
import { llmService } from '../services/llm';
import { parseSlashCommand, findCommand, getCommandSuggestions, type CommandContext } from '../services/slashCommands';
import { parseFileReferences, formatAllReferencesForPrompt } from '../services/fileReference';
import { executionEngine, ExecutionEngine } from '../services/executionEngine';
import { realFileService } from '../services/realFileService';
import type { ExecutionStep } from '../services/executionEngine';

interface ChatPanelProps {
  onCodeGenerated?: (code: string, language: string) => void;
}

interface ToolExecutionUI {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  input?: Record<string, unknown>;
  output?: string;
  duration?: number;
}

const TRIGGER_WORDS = ['开始', '继续', '自主执行', 'autonomous', '自动执行', '帮我做', '自动'];

const isAutoTrigger = (message: string): boolean => {
  const lower = message.toLowerCase();
  return TRIGGER_WORDS.some(word => lower.includes(word.toLowerCase()));
};

export const ChatPanel: React.FC<ChatPanelProps> = ({ onCodeGenerated }) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [toolExecutions, setToolExecutions] = useState<Map<string, ToolExecutionUI>>(new Map());
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [showWorkspacePrompt, setShowWorkspacePrompt] = useState(!realFileService.hasWorkspace());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  const {
    conversations,
    activeConversationId,
    isLoading,
    agentMode,
    createConversation,
    addMessage,
    setLoading,
    toggleTerminal,
    setAgentMode,
    openFile,
  } = useAppStore();

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const messages = useMemo(() => activeConversation?.messages ?? [], [activeConversation]);

  const suggestions = useMemo(() => {
    if (!input) return [];
    
    if (input.startsWith('/')) {
      const cmds = getCommandSuggestions(input);
      return cmds.map(cmd => ({
        type: 'command' as const,
        value: `/${cmd.name}`,
        description: cmd.description,
      }));
    }
    
    const atIndex = input.lastIndexOf('@');
    if (atIndex !== -1 && input.slice(atIndex).indexOf(' ') === -1) {
      const partial = input.slice(atIndex + 1).toLowerCase();
      const files = realFileService.listFiles();
      return files
        .filter(f => f.path.toLowerCase().includes(partial))
        .slice(0, 8)
        .map(f => ({
          type: 'file' as const,
          value: f.path,
        }));
    }
    
    return [];
  }, [input]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, executionSteps]);

  useEffect(() => {
    if (!activeConversationId && conversations.length === 0) {
      createConversation();
    }
  }, [activeConversationId, conversations.length, createConversation]);

  useEffect(() => {
    setShowSuggestions(suggestions.length > 0);
    setSuggestionIndex(0);
  }, [suggestions]);

  useEffect(() => {
    const engine = new ExecutionEngine();
    
    engine.setCallbacks({
      onStep: (step) => {
        setExecutionSteps(prev => [...prev, step]);
      },
      onToolCall: (call) => {
        setToolExecutions(prev => {
          const next = new Map(prev);
          next.set(call.id, {
            id: call.id,
            name: call.name,
            status: 'running',
            input: call.arguments,
          });
          return next;
        });
      },
      onToolResult: (result) => {
        setToolExecutions(prev => {
          const next = new Map(prev);
          const existing = next.get(result.toolCallId);
          if (existing) {
            next.set(result.toolCallId, {
              ...existing,
              status: result.success ? 'success' : 'error',
              output: result.output || result.error,
              duration: result.duration,
            });
          }
          return next;
        });
      },
      onComplete: (summary) => {
        setIsAutoMode(false);
        if (activeConversationId) {
          addMessage(activeConversationId, {
            role: 'assistant',
            content: `✅ 任务完成!\n\n${summary}`,
          });
        }
      },
      onError: (error) => {
        setIsAutoMode(false);
        if (activeConversationId) {
          addMessage(activeConversationId, {
            role: 'assistant',
            content: `❌ 执行错误: ${error}`,
          });
        }
      },
      onAskUser: async (question) => {
        return new Promise((resolve) => {
          const userInput = prompt(question);
          resolve(userInput || '');
        });
      },
      onConfirm: async (message, details) => {
        return confirm(`${message}\n\n${details || ''}`);
      },
    });

    return () => {
      engine.stop();
    };
  }, [activeConversationId, addMessage]);

  const commandContext: CommandContext = {
    setInput,
    addMessage: (role, content) => {
      if (activeConversationId) {
        addMessage(activeConversationId, { role, content });
      }
    },
    openFile,
    toggleTerminal,
    setAgentMode,
    currentAgentMode: agentMode,
  };

  const handleSuggestionSelect = (suggestion: { type: string; value: string; description?: string }) => {
    if (suggestion.type === 'command') {
      setInput(suggestion.value + ' ');
    } else if (suggestion.type === 'file') {
      const atIndex = input.lastIndexOf('@');
      setInput(input.slice(0, atIndex + 1) + suggestion.value + ' ');
    }
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const executeAutoMode = useCallback(async (userMessage: string, conversationId: string) => {
    setIsAutoMode(true);
    setToolExecutions(new Map());
    setExecutionSteps([]);
    
    addMessage(conversationId, {
      role: 'assistant',
      content: '⚡ 启动自动执行模式...\n\n正在分析任务并制定执行计划...',
    });

    try {
      const result = await executionEngine.execute(userMessage);
      
      const toolSummary = Array.from(toolExecutions.values())
        .map(t => `${t.status === 'success' ? '✓' : '✗'} ${t.name}`)
        .join('\n');
      
      addMessage(conversationId, {
        role: 'assistant',
        content: `${result}\n\n📋 执行摘要:\n${toolSummary || '无工具调用'}`,
      });
    } catch (error) {
      addMessage(conversationId, {
        role: 'assistant',
        content: `❌ 自动执行失败: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setIsAutoMode(false);
    }
  }, [addMessage, toolExecutions]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || isAutoMode) return;

    const currentConversationId = activeConversationId || createConversation();
    const userMessage = input.trim();
    setInput('');
    setShowSuggestions(false);

    const { isCommand, command, args } = parseSlashCommand(userMessage);
    
    if (isCommand && command) {
      const cmd = findCommand(command);
      if (cmd) {
        addMessage(currentConversationId, {
          role: 'user',
          content: userMessage,
        });
        
        const result = await cmd.execute(args || '', commandContext);
        
        addMessage(currentConversationId, {
          role: 'assistant',
          content: result.message || (result.success ? '✓ 命令执行成功' : '✗ 命令执行失败'),
        });
        
        if (result.action) {
          result.action();
        }
        
        return;
      }
    }

    const { references, remainingText } = parseFileReferences(userMessage);
    const refContents = new Map<string, string>();
    
    references.forEach(ref => {
      const content = realFileService.readFile(ref.path);
      if (content) {
        refContents.set(ref.path, content);
      }
    });
    
    const refContext = formatAllReferencesForPrompt(references, refContents);
    const enhancedMessage = refContext + remainingText;

    addMessage(currentConversationId, {
      role: 'user',
      content: userMessage,
      references: references.length > 0 ? references.map(r => ({ path: r.path, type: r.type as 'file' | 'folder' })) : undefined,
    });

    if (isAutoTrigger(userMessage)) {
      await executeAutoMode(userMessage, currentConversationId);
      return;
    }

    setLoading(true);

    try {
      const allMessages = activeConversation?.messages.map(m => ({
        role: m.role,
        content: m.content,
      })) || [];
      
      const aiResponse = await llmService.chat([
        ...allMessages,
        { role: 'user', content: enhancedMessage },
      ]);
      
      addMessage(currentConversationId, {
        role: 'assistant',
        content: aiResponse,
      });

      const codeBlocks = extractCodeBlocks(aiResponse);
      if (codeBlocks.length > 0 && onCodeGenerated) {
        onCodeGenerated(codeBlocks[0].code, codeBlocks[0].language);
      }
    } catch (error) {
      addMessage(currentConversationId, {
        role: 'assistant',
        content: `❌ 发生错误：${error instanceof Error ? error.message : '未知错误'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestionIndex(i => (i + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestionIndex(i => (i - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        handleSuggestionSelect(suggestions[suggestionIndex]);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleToolExpand = (id: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreateWorkspace = () => {
    const name = prompt('请输入项目名称:', '我的项目');
    if (name) {
      realFileService.createWorkspace(name);
      setShowWorkspacePrompt(false);
    }
  };

  const handleOpenDirectory = async () => {
    const success = await realFileService.requestDirectoryAccess();
    if (success) {
      setShowWorkspacePrompt(false);
    }
  };

  const renderToolExecution = (tool: ToolExecutionUI) => {
    const isExpanded = expandedTools.has(tool.id);
    const StatusIcon = tool.status === 'success' ? CheckCircle 
      : tool.status === 'error' ? XCircle 
      : tool.status === 'running' ? Loader2 
      : Clock;

    return (
      <div key={tool.id} className="tool-execution-item">
        <div 
          className="flex items-center gap-2 p-2 bg-lcs-surface/50 rounded-lg cursor-pointer hover:bg-lcs-surface/70 transition-colors"
          onClick={() => toggleToolExpand(tool.id)}
        >
          <StatusIcon className={`w-4 h-4 ${
            tool.status === 'success' ? 'text-green-400' :
            tool.status === 'error' ? 'text-red-400' :
            tool.status === 'running' ? 'text-yellow-400 animate-spin' :
            'text-lcs-muted'
          }`} />
          <span className="text-sm font-mono text-lcs-primary">{tool.name}</span>
          {tool.duration && (
            <span className="text-xs text-lcs-muted ml-auto">{tool.duration}ms</span>
          )}
          {isExpanded ? <ChevronUp className="w-4 h-4 text-lcs-muted" /> : <ChevronDown className="w-4 h-4 text-lcs-muted" />}
        </div>
        
        {isExpanded && (
          <div className="mt-2 p-2 bg-lcs-surface/30 rounded-lg text-xs">
            {tool.input && (
              <div className="mb-2">
                <div className="text-lcs-muted mb-1">输入参数:</div>
                <pre className="text-lcs-text overflow-x-auto">{JSON.stringify(tool.input, null, 2)}</pre>
              </div>
            )}
            {tool.output && (
              <div>
                <div className="text-lcs-muted mb-1">输出:</div>
                <pre className="text-lcs-text overflow-x-auto whitespace-pre-wrap">{tool.output}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderExecutionSteps = () => {
    if (executionSteps.length === 0) return null;

    return (
      <div className="execution-steps mb-4 p-3 bg-lcs-surface/50 rounded-lg border border-lcs-border">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-lcs-primary" />
          <span className="text-sm font-medium text-lcs-text">执行进度</span>
          {isAutoMode && <Loader2 className="w-4 h-4 text-lcs-primary animate-spin ml-auto" />}
        </div>
        <div className="space-y-2">
          {executionSteps.slice(-10).map((step) => (
            <div key={step.id} className="text-xs text-lcs-muted">
              {step.type === 'tool_call' && step.toolCall && (
                <div className="flex items-center gap-1">
                  <span className="text-lcs-primary">🔧</span>
                  <span>{step.content}</span>
                </div>
              )}
              {step.type === 'tool_result' && step.toolResult && (
                <div className="ml-4">
                  {renderToolExecution({
                    id: step.toolResult.toolCallId,
                    name: step.toolResult.name,
                    status: step.toolResult.success ? 'success' : 'error',
                    output: step.toolResult.output || step.toolResult.error,
                    duration: step.toolResult.duration,
                  })}
                </div>
              )}
              {step.type === 'think' && (
                <div className="text-lcs-muted italic">{step.content}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';
    const codeBlocks = extractCodeBlocks(message.content);
    const hasCode = codeBlocks.length > 0;

    return (
      <div
        key={message.id}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div
          className={`message-bubble ${isUser ? 'user-message' : 'ai-message'}`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                isUser
                  ? 'bg-lcs-primary-light border-lcs-primary/20'
                  : 'bg-white border-lcs-border'
              }`}
            >
              {isUser ? (
                <User className="w-5 h-5 text-lcs-primary" />
              ) : (
                <Bot className="w-5 h-5 text-lcs-secondary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-lcs-muted mb-1">
                {isUser ? 'LO' : '小码酱'}
              </div>
              <div className="text-lcs-text whitespace-pre-wrap break-words">
                {renderContent(message.content)}
              </div>
              {hasCode && (
                <div className="mt-3 flex gap-2">
                  {codeBlocks.map((block, idx) => (
                    <button
                      key={idx}
                      onClick={() => onCodeGenerated?.(block.code, block.language)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-lcs-primary/20 hover:bg-lcs-primary/30 rounded-lg text-xs text-lcs-primary transition-colors"
                    >
                      <Play className="w-3 h-3" />
                      在编辑器中打开
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, idx) => {
      if (part.startsWith('```')) {
        const match = part.match(/```(\w+)?\n([\s\S]*?)```/);
        if (match) {
          const [, lang, code] = match;
          return (
            <div key={idx} className="code-block my-2 relative group">
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => copyToClipboard(code.trim(), `code-${idx}`)}
                  className="p-1 hover:bg-white/10 rounded"
                >
                  {copiedId === `code-${idx}` ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-lcs-muted" />
                  )}
                </button>
              </div>
              <div className="text-xs text-lcs-muted mb-2">{lang || 'code'}</div>
              <pre className="text-lcs-text overflow-x-auto">
                <code>{code.trim()}</code>
              </pre>
            </div>
          );
        }
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-white border border-lcs-border shadow-sm flex items-center justify-center mb-6">
              <Sparkles className="w-8 h-8 text-lcs-primary" />
            </div>
            <h2 className="text-xl font-medium text-lcs-text mb-2 tracking-tight">
              小码酱
            </h2>
            <p className="text-lcs-muted max-w-sm mb-8 text-sm leading-relaxed">
              全自动编程助手。
              <br />
              输入「开始」即可触发自动执行模式。
            </p>

            {showWorkspacePrompt && (
              <div className="mb-6 p-4 bg-lcs-surface/50 rounded-lg border border-lcs-border max-w-md">
                <div className="text-sm text-lcs-text mb-3">📁 开始之前，请选择工作方式：</div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleCreateWorkspace}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-lcs-primary/20 hover:bg-lcs-primary/30 rounded-lg text-sm text-lcs-primary transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    创建新项目
                  </button>
                  <button
                    onClick={handleOpenDirectory}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-lcs-secondary/20 hover:bg-lcs-secondary/30 rounded-lg text-sm text-lcs-secondary transition-colors"
                  >
                    <FolderOpen className="w-4 h-4" />
                    打开本地文件夹
                  </button>
                </div>
                <div className="text-xs text-lcs-muted mt-2">
                  * 文件将保存在浏览器本地存储中
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-2 mb-4">
              <button
                onClick={() => setInput('开始 帮我创建一个React组件')}
                className="px-4 py-2 bg-white border border-lcs-border hover:border-lcs-primary/50 hover:text-lcs-primary rounded-lg text-sm text-lcs-muted transition-colors flex items-center gap-2 shadow-sm"
              >
                <Zap className="w-4 h-4" />
                一键创建组件
              </button>
              <button
                onClick={() => setInput('开始 分析这个项目结构')}
                className="px-4 py-2 bg-white border border-lcs-border hover:border-lcs-secondary/50 hover:text-lcs-secondary rounded-lg text-sm text-lcs-muted transition-colors flex items-center gap-2 shadow-sm"
              >
                <Zap className="w-4 h-4" />
                分析项目
              </button>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => setInput('/help')}
                className="px-3 py-1.5 bg-lcs-surface hover:bg-lcs-surface/70 rounded-lg text-xs text-lcs-text transition-colors"
              >
                /help - 查看命令
              </button>
              <button
                onClick={() => setInput('/open ')}
                className="px-3 py-1.5 bg-lcs-surface hover:bg-lcs-surface/70 rounded-lg text-xs text-lcs-text transition-colors"
              >
                /open - 打开文件
              </button>
              <button
                onClick={() => setInput('/terminal')}
                className="px-3 py-1.5 bg-lcs-surface hover:bg-lcs-surface/70 rounded-lg text-xs text-lcs-text transition-colors"
              >
                /terminal - 终端
              </button>
            </div>
          </div>
        ) : (
          <>
            {messages.map(renderMessage)}
            {renderExecutionSteps()}
          </>
        )}
        {(isLoading || isAutoMode) && (
          <div className="flex justify-start mb-4">
            <div className="message-bubble ai-message">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white border border-lcs-border flex items-center justify-center">
                  <Bot className="w-5 h-5 text-lcs-secondary" />
                </div>
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-lcs-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-lcs-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-lcs-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                {isAutoMode && <span className="text-xs text-lcs-primary">自动执行中...</span>}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-lcs-border">
        <div className="glass-panel p-2 flex items-end gap-2 relative">
          <div className="flex items-center gap-1 px-2">
            <button
              onClick={() => setInput('/' + input)}
              className="p-1.5 hover:bg-lcs-primary/20 rounded text-lcs-muted hover:text-lcs-primary transition-colors"
              title="斜杠命令"
            >
              <Slash className="w-4 h-4" />
            </button>
            <button
              onClick={() => setInput(input + '@')}
              className="p-1.5 hover:bg-lcs-primary/20 rounded text-lcs-muted hover:text-lcs-primary transition-colors"
              title="引用文件"
            >
              <AtSign className="w-4 h-4" />
            </button>
          </div>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="和小码酱对话... (输入「开始」触发自动执行)"
            className="flex-1 bg-transparent border-none outline-none resize-none text-lcs-text placeholder-lcs-muted min-h-[40px] max-h-[200px] p-2"
            rows={1}
            style={{
              height: 'auto',
              minHeight: '40px',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isAutoMode}
            className="p-2 rounded-lg bg-lcs-primary hover:bg-lcs-primary-hover text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-4 h-4" />
          </button>

          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute bottom-full left-0 right-0 mb-2 bg-lcs-surface border border-lcs-border rounded-lg shadow-xl overflow-hidden"
            >
              {suggestions.map((suggestion, idx) => (
                <div
                  key={suggestion.value}
                  onClick={() => handleSuggestionSelect(suggestion)}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                    idx === suggestionIndex
                      ? 'bg-lcs-primary/20 text-lcs-primary'
                      : 'hover:bg-lcs-primary/10 text-lcs-text'
                  }`}
                >
                  {suggestion.type === 'command' ? (
                    <Slash className="w-4 h-4 text-lcs-primary" />
                  ) : (
                    <AtSign className="w-4 h-4 text-lcs-secondary" />
                  )}
                  <span className="text-sm">{suggestion.value}</span>
                  {'description' in suggestion && suggestion.description && (
                    <span className="text-xs text-lcs-muted ml-auto">{suggestion.description}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-lcs-muted">
          <div className="flex items-center gap-2">
            <span>按 Enter 发送，Shift+Enter 换行</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
              agentMode === 'build' 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {agentMode === 'build' ? '🔧 Build' : '🔒 Plan'}
            </span>
            {isAutoMode && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-lcs-primary/20 text-lcs-primary animate-pulse">
                ⚡ 自动执行
              </span>
            )}
            {realFileService.hasWorkspace() && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-lcs-secondary/20 text-lcs-secondary">
                📁 {realFileService.getWorkspace()?.name}
              </span>
            )}
          </div>
          <span className="flex items-center gap-1">
            <Code2 className="w-3 h-3" />
            支持代码高亮
          </span>
        </div>
      </div>
    </div>
  );
};
