import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  images?: Array<{
    id: string;
    name: string;
    dataUrl: string;
  }>;
  references?: Array<{
    path: string;
    type: 'file' | 'folder';
  }>;
  tokens?: {
    input: number;
    output: number;
  };
}

export interface Session {
  id: string;
  title: string;
  messages: SessionMessage[];
  createdAt: number;
  updatedAt: number;
  model?: string;
  provider?: string;
  summary?: string;
  tags?: string[];
  starred?: boolean;
}

export interface SessionFolder {
  id: string;
  name: string;
  sessions: string[];
  createdAt: number;
}

interface SessionState {
  sessions: Session[];
  folders: SessionFolder[];
  activeSessionId: string | null;
  searchQuery: string;
  
  createSession: (title?: string) => string;
  deleteSession: (id: string) => void;
  duplicateSession: (id: string) => string;
  renameSession: (id: string, title: string) => void;
  setActiveSession: (id: string | null) => void;
  starSession: (id: string) => void;
  
  addMessage: (sessionId: string, message: Omit<SessionMessage, 'id' | 'timestamp'>) => void;
  deleteMessage: (sessionId: string, messageId: string) => void;
  editMessage: (sessionId: string, messageId: string, content: string) => void;
  
  createFolder: (name: string) => string;
  deleteFolder: (id: string) => void;
  renameFolder: (id: string, name: string) => void;
  moveSessionToFolder: (sessionId: string, folderId: string | null) => void;
  
  setSearchQuery: (query: string) => void;
  getFilteredSessions: () => Session[];
  
  exportSession: (id: string) => string;
  importSession: (data: string) => string | null;
  
  getSessionStats: () => {
    totalSessions: number;
    totalMessages: number;
    totalTokens: number;
    starredCount: number;
  };
}

const generateTitle = (firstMessage: string): string => {
  const cleaned = firstMessage.replace(/[@/#]/g, '').trim();
  return cleaned.slice(0, 40) + (cleaned.length > 40 ? '...' : '');
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      folders: [],
      activeSessionId: null,
      searchQuery: '',

      createSession: (title?: string) => {
        const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const newSession: Session = {
          id,
          title: title || '新对话',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({
          sessions: [newSession, ...state.sessions],
          activeSessionId: id,
        }));
        return id;
      },

      deleteSession: (id) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
        }));
      },

      duplicateSession: (id) => {
        const session = get().sessions.find((s) => s.id === id);
        if (!session) return '';
        
        const newId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const newSession: Session = {
          ...session,
          id: newId,
          title: `${session.title} (副本)`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        
        set((state) => ({
          sessions: [newSession, ...state.sessions],
        }));
        
        return newId;
      },

      renameSession: (id, title) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, title, updatedAt: Date.now() } : s
          ),
        }));
      },

      setActiveSession: (id) => {
        set({ activeSessionId: id });
      },

      starSession: (id) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, starred: !s.starred } : s
          ),
        }));
      },

      addMessage: (sessionId, message) => {
        const newMessage: SessionMessage = {
          ...message,
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          timestamp: Date.now(),
        };
        
        set((state) => ({
          sessions: state.sessions.map((s) => {
            if (s.id !== sessionId) return s;
            
            const updatedMessages = [...s.messages, newMessage];
            const title = s.messages.length === 0 && message.role === 'user'
              ? generateTitle(message.content)
              : s.title;
            
            return {
              ...s,
              messages: updatedMessages,
              title,
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      deleteMessage: (sessionId, messageId) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: s.messages.filter((m) => m.id !== messageId),
                  updatedAt: Date.now(),
                }
              : s
          ),
        }));
      },

      editMessage: (sessionId, messageId, content) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === messageId ? { ...m, content } : m
                  ),
                  updatedAt: Date.now(),
                }
              : s
          ),
        }));
      },

      createFolder: (name) => {
        const id = `folder-${Date.now()}`;
        const folder: SessionFolder = {
          id,
          name,
          sessions: [],
          createdAt: Date.now(),
        };
        set((state) => ({
          folders: [...state.folders, folder],
        }));
        return id;
      },

      deleteFolder: (id) => {
        set((state) => ({
          folders: state.folders.filter((f) => f.id !== id),
        }));
      },

      renameFolder: (id, name) => {
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === id ? { ...f, name } : f
          ),
        }));
      },

      moveSessionToFolder: (sessionId, folderId) => {
        set((state) => ({
          folders: state.folders.map((f) => ({
            ...f,
            sessions: folderId === f.id
              ? [...f.sessions.filter((s) => s !== sessionId), sessionId]
              : f.sessions.filter((s) => s !== sessionId),
          })),
        }));
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query });
      },

      getFilteredSessions: () => {
        const { sessions, searchQuery } = get();
        if (!searchQuery) return sessions;
        
        const query = searchQuery.toLowerCase();
        return sessions.filter(
          (s) =>
            s.title.toLowerCase().includes(query) ||
            s.messages.some((m) => m.content.toLowerCase().includes(query))
        );
      },

      exportSession: (id) => {
        const session = get().sessions.find((s) => s.id === id);
        if (!session) return '';
        
        return JSON.stringify(session, null, 2);
      },

      importSession: (data) => {
        try {
          const session = JSON.parse(data) as Session;
          const newId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          
          const importedSession: Session = {
            ...session,
            id: newId,
            title: `${session.title} (导入)`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          
          set((state) => ({
            sessions: [importedSession, ...state.sessions],
          }));
          
          return newId;
        } catch {
          return null;
        }
      },

      getSessionStats: () => {
        const { sessions } = get();
        return {
          totalSessions: sessions.length,
          totalMessages: sessions.reduce((sum, s) => sum + s.messages.length, 0),
          totalTokens: sessions.reduce(
            (sum, s) => sum + s.messages.reduce((mSum, m) => mSum + (m.tokens?.input || 0) + (m.tokens?.output || 0), 0),
            0
          ),
          starredCount: sessions.filter((s) => s.starred).length,
        };
      },
    }),
    {
      name: 'lcs-sessions',
      partialize: (state) => ({
        sessions: state.sessions,
        folders: state.folders,
      }),
    }
  )
);
