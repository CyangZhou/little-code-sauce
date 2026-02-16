import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AgentMode = 'build' | 'plan';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  codeBlocks?: CodeBlock[];
  references?: FileReference[];
}

export interface CodeBlock {
  id: string;
  language: string;
  code: string;
  filename?: string;
}

export interface FileReference {
  path: string;
  type: 'file' | 'folder';
  content?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface EditorState {
  openFiles: string[];
  activeFile: string | null;
  fileContents: Record<string, string>;
}

export interface TerminalState {
  visible: boolean;
  history: string[];
  output: string;
}

interface AppState {
  conversations: Conversation[];
  activeConversationId: string | null;
  editor: EditorState;
  terminal: TerminalState;
  isLoading: boolean;
  isDarkMode: boolean;
  agentMode: AgentMode;
  projectFiles: string[];
  
  createConversation: () => string;
  deleteConversation: (id: string) => void;
  setActiveConversation: (id: string) => void;
  addMessage: (conversationId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  clearConversation: (conversationId: string) => void;
  
  openFile: (filename: string, content?: string) => void;
  closeFile: (filename: string) => void;
  setActiveFile: (filename: string | null) => void;
  updateFileContent: (filename: string, content: string) => void;
  
  toggleTerminal: () => void;
  setTerminalVisible: (visible: boolean) => void;
  addTerminalHistory: (command: string) => void;
  setTerminalOutput: (output: string) => void;
  
  setLoading: (loading: boolean) => void;
  toggleDarkMode: () => void;
  setAgentMode: (mode: AgentMode) => void;
  setProjectFiles: (files: string[]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      conversations: [],
      activeConversationId: null,
      editor: {
        openFiles: [],
        activeFile: null,
        fileContents: {},
      },
      terminal: {
        visible: false,
        history: [],
        output: '',
      },
      isLoading: false,
      isDarkMode: true,
      agentMode: 'build',
      projectFiles: [],

      createConversation: () => {
        const id = `conv-${Date.now()}`;
        const newConversation: Conversation = {
          id,
          title: '新对话',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({
          conversations: [newConversation, ...state.conversations],
          activeConversationId: id,
        }));
        return id;
      },

      deleteConversation: (id) => {
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
          activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
        }));
      },

      setActiveConversation: (id) => {
        set({ activeConversationId: id });
      },

      addMessage: (conversationId, message) => {
        const newMessage: Message = {
          ...message,
          id: `msg-${Date.now()}`,
          timestamp: Date.now(),
        };
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: [...c.messages, newMessage],
                  updatedAt: Date.now(),
                  title: c.messages.length === 0 && message.role === 'user' 
                    ? message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '')
                    : c.title,
                }
              : c
          ),
        }));
      },

      clearConversation: (conversationId) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, messages: [], title: '新对话', updatedAt: Date.now() }
              : c
          ),
        }));
      },

      openFile: (filename, content = '') => {
        set((state) => {
          const existingContent = state.editor.fileContents[filename];
          return {
            editor: {
              ...state.editor,
              openFiles: state.editor.openFiles.includes(filename)
                ? state.editor.openFiles
                : [...state.editor.openFiles, filename],
              activeFile: filename,
              fileContents: {
                ...state.editor.fileContents,
                [filename]: existingContent ?? content,
              },
            },
          };
        });
      },

      closeFile: (filename) => {
        set((state) => {
          const newOpenFiles = state.editor.openFiles.filter((f) => f !== filename);
          const { [filename]: _, ...remainingContents } = state.editor.fileContents;
          return {
            editor: {
              ...state.editor,
              openFiles: newOpenFiles,
              activeFile: state.editor.activeFile === filename
                ? newOpenFiles[newOpenFiles.length - 1] || null
                : state.editor.activeFile,
              fileContents: remainingContents,
            },
          };
        });
      },

      setActiveFile: (filename) => {
        set((state) => ({
          editor: { ...state.editor, activeFile: filename },
        }));
      },

      updateFileContent: (filename, content) => {
        set((state) => ({
          editor: {
            ...state.editor,
            fileContents: { ...state.editor.fileContents, [filename]: content },
          },
        }));
      },

      toggleTerminal: () => {
        set((state) => ({
          terminal: { ...state.terminal, visible: !state.terminal.visible },
        }));
      },

      setTerminalVisible: (visible) => {
        set((state) => ({
          terminal: { ...state.terminal, visible },
        }));
      },

      addTerminalHistory: (command) => {
        set((state) => ({
          terminal: {
            ...state.terminal,
            history: [...state.terminal.history, command].slice(-100),
          },
        }));
      },

      setTerminalOutput: (output) => {
        set((state) => ({
          terminal: { ...state.terminal, output },
        }));
      },

      setLoading: (loading) => set({ isLoading: loading }),
      toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      setAgentMode: (mode) => set({ agentMode: mode }),
      setProjectFiles: (files) => set({ projectFiles: files }),
    }),
    {
      name: 'little-code-sauce-storage',
      partialize: (state) => ({
        conversations: state.conversations,
        editor: state.editor,
        isDarkMode: state.isDarkMode,
        agentMode: state.agentMode,
      }),
    }
  )
);
