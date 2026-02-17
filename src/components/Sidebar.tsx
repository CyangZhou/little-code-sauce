import React from 'react';
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  Settings, 
  Sparkles,
  FolderOpen,
  ChevronRight,
  Code
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { Conversation } from '../store/useAppStore';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, onOpenSettings }) => {
  const {
    conversations,
    activeConversationId,
    createConversation,
    deleteConversation,
    setActiveConversation,
    openFile,
  } = useAppStore();

  const handleNewChat = () => {
    createConversation();
  };

  if (collapsed) {
    return (
      <div className="w-16 bg-white border-r border-lcs-border flex flex-col items-center py-4 transition-all duration-300">
        <div className="mb-6">
            <div className="w-10 h-10 rounded-xl bg-lcs-primary/10 flex items-center justify-center text-lcs-primary">
                <Sparkles className="w-6 h-6" />
            </div>
        </div>
        
        <button
          onClick={handleNewChat}
          className="p-3 bg-lcs-primary text-white rounded-xl shadow-lg shadow-lcs-primary/20 hover:bg-lcs-primary-hover transition-all mb-6"
        >
          <Plus className="w-5 h-5" />
        </button>
        
        <div className="flex-1 flex flex-col items-center gap-4">
          <button onClick={onToggle} className="p-2 hover:bg-lcs-muted/10 rounded-lg text-lcs-muted hover:text-lcs-text transition-colors" title="展开">
             <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        
        <button 
          onClick={onOpenSettings}
          className="p-3 hover:bg-lcs-muted/10 rounded-xl text-lcs-muted hover:text-lcs-text transition-colors mt-auto"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 bg-white border-r border-lcs-border flex flex-col transition-all duration-300">
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-lcs-primary/10 flex items-center justify-center text-lcs-primary">
            <Code className="w-5 h-5" />
          </div>
          <span className="font-semibold text-lg text-lcs-text tracking-tight">
            小码酱
          </span>
        </div>
      </div>

      <div className="px-4 mb-6">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-lcs-primary text-white rounded-xl shadow-lg shadow-lcs-primary/25 hover:bg-lcs-primary-hover hover:shadow-lcs-primary/40 hover:-translate-y-0.5 transition-all duration-200 font-medium"
        >
          <Plus className="w-5 h-5" />
          开启新对话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
        <div>
            <div className="text-xs font-semibold text-lcs-muted/70 uppercase tracking-wider mb-3 px-3">历史记录</div>
            <div className="space-y-1">
            {conversations.map((conv: Conversation) => (
                <div
                key={conv.id}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                    conv.id === activeConversationId
                    ? 'bg-lcs-primary-light text-lcs-primary font-medium'
                    : 'hover:bg-lcs-muted/5 text-lcs-text'
                }`}
                onClick={() => setActiveConversation(conv.id)}
                >
                <MessageSquare className={`w-4 h-4 shrink-0 ${conv.id === activeConversationId ? 'text-lcs-primary' : 'text-lcs-muted'}`} />
                <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{conv.title}</div>
                </div>
                <button
                    onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 rounded-md text-lcs-muted hover:text-red-500 transition-all"
                >
                    <Trash2 className="w-3 h-3" />
                </button>
                </div>
            ))}
            </div>
        </div>
      </div>

      <div className="p-4 border-t border-lcs-border bg-lcs-bg/30">
        <div className="space-y-1">
          <button
            onClick={() => openFile('untitled.ts', '// 小码酱代码编辑器\n// 开始编写你的代码...\n')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-lcs-text hover:bg-white hover:shadow-sm transition-all"
          >
            <FolderOpen className="w-4 h-4 text-lcs-muted" />
            <span className="text-sm">新建文件</span>
          </button>
          <button 
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-lcs-text hover:bg-white hover:shadow-sm transition-all"
          >
            <Settings className="w-4 h-4 text-lcs-muted" />
            <span className="text-sm">设置</span>
          </button>
        </div>
      </div>
    </div>
  );
};
