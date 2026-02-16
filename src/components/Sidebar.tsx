import React from 'react';
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  Settings, 
  Sparkles,
  FolderOpen,
  History,
  ChevronLeft,
  ChevronRight,
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

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  if (collapsed) {
    return (
      <div className="w-14 bg-lcs-surface border-r border-lcs-border flex flex-col items-center py-4">
        <button
          onClick={onToggle}
          className="p-2 hover:bg-lcs-primary/20 rounded-lg text-lcs-muted hover:text-lcs-primary transition-colors mb-4"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        
        <button
          onClick={handleNewChat}
          className="p-2 bg-gradient-to-r from-lcs-primary to-lcs-secondary rounded-lg text-white mb-4"
        >
          <Plus className="w-5 h-5" />
        </button>
        
        <div className="flex-1 flex flex-col items-center gap-2">
          <MessageSquare className="w-5 h-5 text-lcs-muted" />
          <History className="w-5 h-5 text-lcs-muted mt-2" />
          <FolderOpen className="w-5 h-5 text-lcs-muted mt-2" />
        </div>
        
        <button 
          onClick={onOpenSettings}
          className="p-2 hover:bg-lcs-surface rounded-lg text-lcs-muted hover:text-lcs-text transition-colors mt-auto"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 bg-lcs-surface border-r border-lcs-border flex flex-col">
      <div className="p-4 border-b border-lcs-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-lcs-primary to-lcs-secondary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold bg-gradient-to-r from-lcs-primary to-lcs-secondary bg-clip-text text-transparent">
            小码酱
          </span>
        </div>
        <button
          onClick={onToggle}
          className="p-1 hover:bg-lcs-primary/20 rounded text-lcs-muted hover:text-lcs-primary transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-lcs-primary to-lcs-secondary rounded-lg text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          新对话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        <div className="text-xs text-lcs-muted mb-2 px-1">对话历史</div>
        <div className="space-y-1">
          {conversations.map((conv: Conversation) => (
            <div
              key={conv.id}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                conv.id === activeConversationId
                  ? 'bg-lcs-primary/20 text-lcs-primary'
                  : 'hover:bg-lcs-surface text-lcs-text'
              }`}
              onClick={() => setActiveConversation(conv.id)}
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{conv.title}</div>
                <div className="text-xs text-lcs-muted">{formatDate(conv.updatedAt)}</div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(conv.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-lcs-muted hover:text-red-400 transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 border-t border-lcs-border">
        <div className="text-xs text-lcs-muted mb-2 px-1">快速操作</div>
        <div className="space-y-1">
          <button
            onClick={() => openFile('untitled.ts', '// 小码酱代码编辑器\n// 开始编写你的代码...\n')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-lcs-text hover:bg-lcs-primary/10 transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            <span className="text-sm">新建文件</span>
          </button>
          <button 
            onClick={onOpenSettings}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-lcs-text hover:bg-lcs-primary/10 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm">设置</span>
          </button>
        </div>
      </div>
    </div>
  );
};
