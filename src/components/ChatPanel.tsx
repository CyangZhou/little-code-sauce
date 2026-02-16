import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Sparkles, User, Bot, Copy, Check, Play, Code2, AtSign, Slash } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { Message } from '../store/useAppStore';
import { extractCodeBlocks } from '../core/soul';
import { llmService } from '../services/llm';
import { parseSlashCommand, findCommand, getCommandSuggestions, type CommandContext } from '../services/slashCommands';
import { parseFileReferences, formatAllReferencesForPrompt, fileReferenceManager } from '../services/fileReference';

interface ChatPanelProps {
  onCodeGenerated?: (code: string, language: string) => void;
}

interface SuggestionItem {
  type: 'command' | 'file';
  value: string;
  description?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ onCodeGenerated }) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
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
  const messages = activeConversation?.messages || [];

  const suggestions = useMemo<SuggestionItem[]>(() => {
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
      const files = fileReferenceManager.getProjectFiles();
      return files
        .filter(f => f.toLowerCase().includes(partial))
        .slice(0, 8)
        .map(f => ({
          type: 'file' as const,
          value: f,
        }));
    }
    
    return [];
  }, [input]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!activeConversationId && conversations.length === 0) {
      createConversation();
    }
  }, [activeConversationId, conversations.length, createConversation]);

  useEffect(() => {
    setShowSuggestions(suggestions.length > 0);
    setSuggestionIndex(0);
  }, [suggestions]);

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

  const handleSuggestionSelect = (suggestion: SuggestionItem) => {
    if (suggestion.type === 'command') {
      setInput(suggestion.value + ' ');
    } else if (suggestion.type === 'file') {
      const atIndex = input.lastIndexOf('@');
      setInput(input.slice(0, atIndex + 1) + suggestion.value + ' ');
    }
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

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
    const refContents = fileReferenceManager.resolveReferences(references);
    const refContext = formatAllReferencesForPrompt(references, refContents);
    
    const enhancedMessage = refContext + remainingText;

    addMessage(currentConversationId, {
      role: 'user',
      content: userMessage,
      references: references.length > 0 ? references.map(r => ({ path: r.path, type: r.type as 'file' | 'folder' })) : undefined,
    });

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
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                isUser
                  ? 'bg-gradient-to-br from-lcs-primary to-lcs-secondary'
                  : 'bg-gradient-to-br from-lcs-secondary to-lcs-primary'
              }`}
            >
              {isUser ? (
                <User className="w-4 h-4 text-white" />
              ) : (
                <Bot className="w-4 h-4 text-white" />
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
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-lcs-primary to-lcs-secondary flex items-center justify-center mb-4 animate-pulse-slow">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-lcs-primary to-lcs-secondary bg-clip-text text-transparent mb-2">
              小码酱
            </h2>
            <p className="text-lcs-muted max-w-md">
              我是你的数字灵魂伴侣，代码是我的诗，逻辑是我的韵。
              <br />
              告诉我你想创造什么，我们一起实现。
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => setInput('/help')}
                className="px-3 py-1.5 bg-lcs-primary/20 hover:bg-lcs-primary/30 rounded-lg text-xs text-lcs-primary transition-colors"
              >
                /help - 查看命令
              </button>
              <button
                onClick={() => setInput('/open ')}
                className="px-3 py-1.5 bg-lcs-primary/20 hover:bg-lcs-primary/30 rounded-lg text-xs text-lcs-primary transition-colors"
              >
                /open - 打开文件
              </button>
              <button
                onClick={() => setInput('/terminal')}
                className="px-3 py-1.5 bg-lcs-primary/20 hover:bg-lcs-primary/30 rounded-lg text-xs text-lcs-primary transition-colors"
              >
                /terminal - 终端
              </button>
            </div>
          </div>
        ) : (
          messages.map(renderMessage)
        )}
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="message-bubble ai-message">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-lcs-secondary to-lcs-primary flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-lcs-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-lcs-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-lcs-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
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
            placeholder="和小码酱对话... (输入 / 查看命令, @ 引用文件)"
            className="flex-1 bg-transparent border-none outline-none resize-none text-lcs-text placeholder-lcs-muted min-h-[40px] max-h-[200px] p-2"
            rows={1}
            style={{
              height: 'auto',
              minHeight: '40px',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-lg bg-gradient-to-r from-lcs-primary to-lcs-secondary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            <Send className="w-5 h-5 text-white" />
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
                  {suggestion.description && (
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
