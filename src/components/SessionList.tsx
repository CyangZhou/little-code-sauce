import React, { useState } from 'react';
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  Star, 
  MoreVertical, 
  Search,
  Edit2,
  Copy,
  Download,
} from 'lucide-react';
import type { Session } from '../services/sessionManager';
import { useSessionStore } from '../services/sessionManager';

interface SessionListProps {
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}

export const SessionList: React.FC<SessionListProps> = ({ onSelectSession, onNewSession }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  
  const {
    sessions,
    activeSessionId,
    setSearchQuery: setStoreSearchQuery,
    deleteSession,
    duplicateSession,
    renameSession,
    starSession,
    setActiveSession,
    exportSession,
  } = useSessionStore();

  const filteredSessions = searchQuery
    ? sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.messages.some((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : sessions;

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setStoreSearchQuery(query);
  };

  const handleRename = (id: string, title: string) => {
    renameSession(id, title);
    setEditingId(null);
    setEditTitle('');
  };

  const handleExport = (id: string) => {
    const data = exportSession(id);
    if (data) {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setShowMenu(null);
  };

  const handleDuplicate = (id: string) => {
    const newId = duplicateSession(id);
    if (newId) {
      setActiveSession(newId);
    }
    setShowMenu(null);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    
    return date.toLocaleDateString();
  };

  const renderSession = (session: Session) => {
    const isActive = session.id === activeSessionId;
    const isEditing = editingId === session.id;
    
    return (
      <div
        key={session.id}
        className={`group relative flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
          isActive
            ? 'bg-lcs-primary/20 text-lcs-primary'
            : 'hover:bg-lcs-surface text-lcs-text'
        }`}
        onClick={() => !isEditing && onSelectSession(session.id)}
      >
        <MessageSquare className="w-4 h-4 mt-0.5 shrink-0" />
        
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => handleRename(session.id, editTitle)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRename(session.id, editTitle);
                } else if (e.key === 'Escape') {
                  setEditingId(null);
                }
              }}
              className="w-full bg-lcs-bg border border-lcs-primary rounded px-2 py-1 text-sm text-lcs-text"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium truncate">{session.title}</span>
                {session.starred && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
              </div>
              <div className="flex items-center gap-2 text-xs text-lcs-muted mt-0.5">
                <span>{formatDate(session.updatedAt)}</span>
                <span>·</span>
                <span>{session.messages.length}条消息</span>
              </div>
            </>
          )}
        </div>
        
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(showMenu === session.id ? null : session.id);
            }}
            className="p-1 hover:bg-lcs-primary/20 rounded"
          >
            <MoreVertical className="w-3 h-3" />
          </button>
        </div>
        
        {showMenu === session.id && (
          <div className="absolute right-0 top-full mt-1 w-40 bg-lcs-surface border border-lcs-border rounded-lg shadow-xl z-50">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingId(session.id);
                setEditTitle(session.title);
                setShowMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lcs-text hover:bg-lcs-primary/10"
            >
              <Edit2 className="w-3 h-3" />
              重命名
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                starSession(session.id);
                setShowMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lcs-text hover:bg-lcs-primary/10"
            >
              <Star className="w-3 h-3" />
              {session.starred ? '取消收藏' : '收藏'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDuplicate(session.id);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lcs-text hover:bg-lcs-primary/10"
            >
              <Copy className="w-3 h-3" />
              复制会话
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleExport(session.id);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-lcs-text hover:bg-lcs-primary/10"
            >
              <Download className="w-3 h-3" />
              导出
            </button>
            <div className="border-t border-lcs-border" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteSession(session.id);
                setShowMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-3 h-3" />
              删除
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-lcs-border">
        <button
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-lcs-primary hover:bg-lcs-primary/80 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建对话
        </button>
      </div>

      <div className="p-2 border-b border-lcs-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-lcs-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜索对话..."
            className="w-full pl-8 pr-3 py-1.5 bg-lcs-bg border border-lcs-border rounded-lg text-sm text-lcs-text placeholder-lcs-muted focus:outline-none focus:border-lcs-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredSessions.length === 0 ? (
          <div className="text-center text-lcs-muted text-sm py-8">
            {searchQuery ? '没有找到匹配的对话' : '暂无对话记录'}
          </div>
        ) : (
          <>
            {filteredSessions.some((s) => s.starred) && (
              <div className="mb-2">
                <div className="flex items-center gap-1 px-2 py-1 text-xs text-lcs-muted">
                  <Star className="w-3 h-3" />
                  收藏
                </div>
                {filteredSessions
                  .filter((s) => s.starred)
                  .map(renderSession)}
              </div>
            )}
            
            <div>
              <div className="flex items-center gap-1 px-2 py-1 text-xs text-lcs-muted">
                <MessageSquare className="w-3 h-3" />
                最近
              </div>
              {filteredSessions
                .filter((s) => !s.starred)
                .map(renderSession)}
            </div>
          </>
        )}
      </div>

      <div className="p-2 border-t border-lcs-border">
        <div className="flex items-center justify-between text-xs text-lcs-muted">
          <span>{sessions.length} 个对话</span>
          <span>{sessions.reduce((sum, s) => sum + s.messages.length, 0)} 条消息</span>
        </div>
      </div>
    </div>
  );
};
