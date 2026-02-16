import { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatPanel } from './components/ChatPanel';
import { CodeEditor } from './components/CodeEditor';
import { SettingsPanel } from './components/SettingsPanel';
import { ToolConfirmDialog } from './components/ToolConfirmDialog';
import { TerminalPanel } from './components/TerminalPanel';
import { FileExplorer } from './components/FileExplorer';
import { useAppStore } from './store/useAppStore';
import { PanelLeftClose, PanelLeft, Code2, MessageSquare, Terminal, FolderOpen } from 'lucide-react';
import { toolExecutionService } from './services/toolExecution';
import { permissionService } from './services/permission';
import { fileReferenceManager } from './services/fileReference';

type ViewMode = 'chat' | 'code' | 'split';

interface PendingConfirmation {
  toolId: string;
  params: Record<string, unknown>;
  resolve: (approved: boolean) => void;
}

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fileExplorerOpen, setFileExplorerOpen] = useState(true);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const { openFile, terminal, toggleTerminal, setProjectFiles } = useAppStore();

  useEffect(() => {
    const projectFiles = [
      'src/App.tsx',
      'src/main.tsx',
      'src/index.css',
      'src/components/ChatPanel.tsx',
      'src/components/CodeEditor.tsx',
      'src/components/Sidebar.tsx',
      'src/components/TerminalPanel.tsx',
      'src/components/FileExplorer.tsx',
      'src/components/SettingsPanel.tsx',
      'src/services/llm.ts',
      'src/services/mcp.ts',
      'src/services/toolExecution.ts',
      'src/services/slashCommands.ts',
      'src/services/fileReference.ts',
      'src/store/useAppStore.ts',
      'src/core/soul.ts',
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'README.md',
    ];
    setProjectFiles(projectFiles);
    fileReferenceManager.setProjectFiles(projectFiles);
  }, [setProjectFiles]);

  const handleConfirmation = useCallback(async (toolId: string, params: Record<string, unknown>): Promise<boolean> => {
    return new Promise((resolve) => {
      setPendingConfirmation({ toolId, params, resolve });
    });
  }, []);

  useState(() => {
    toolExecutionService.setConfirmationCallback(handleConfirmation);
  });

  const handleConfirmDecision = (approved: boolean, remember: boolean = false) => {
    if (pendingConfirmation) {
      pendingConfirmation.resolve(approved);
      if (remember && approved) {
        permissionService.setPermission(pendingConfirmation.toolId, 'allow');
      } else if (remember && !approved) {
        permissionService.setPermission(pendingConfirmation.toolId, 'deny');
      }
      setPendingConfirmation(null);
    }
  };

  const handleCodeGenerated = (code: string, language: string) => {
    const ext = language === 'typescript' ? 'ts' : 
                language === 'javascript' ? 'js' : 
                language === 'python' ? 'py' : 
                language === 'rust' ? 'rs' : 'txt';
    const filename = `code-${Date.now()}.${ext}`;
    openFile(filename, code);
    setViewMode('split');
  };

  const handleExecute = (code: string, language: string) => {
    console.log('Executing code:', { language, codeLength: code.length });
  };

  return (
    <div className="h-screen flex bg-lcs-bg overflow-hidden">
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      
      {fileExplorerOpen && (
        <div className="w-60 border-r border-lcs-border flex-shrink-0">
          <FileExplorer />
        </div>
      )}
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 bg-lcs-surface/50 border-b border-lcs-border flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 hover:bg-lcs-primary/20 rounded-lg text-lcs-muted hover:text-lcs-primary transition-colors"
            >
              {sidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setFileExplorerOpen(!fileExplorerOpen)}
              className={`p-1.5 rounded-lg transition-colors ${
                fileExplorerOpen 
                  ? 'bg-lcs-primary/20 text-lcs-primary' 
                  : 'text-lcs-muted hover:text-lcs-text hover:bg-lcs-primary/10'
              }`}
              title="文件浏览器"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
            <span className="text-lcs-muted">|</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode('chat')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'chat' 
                    ? 'bg-lcs-primary/20 text-lcs-primary' 
                    : 'text-lcs-muted hover:text-lcs-text'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('code')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'code' 
                    ? 'bg-lcs-primary/20 text-lcs-primary' 
                    : 'text-lcs-muted hover:text-lcs-text'
                }`}
              >
                <Code2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-2 py-1 rounded-lg text-xs transition-colors ${
                  viewMode === 'split' 
                    ? 'bg-lcs-primary/20 text-lcs-primary' 
                    : 'text-lcs-muted hover:text-lcs-text'
                }`}
              >
                分屏
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTerminal}
              className={`p-1.5 rounded-lg transition-colors ${
                terminal.visible 
                  ? 'bg-lcs-primary/20 text-lcs-primary' 
                  : 'text-lcs-muted hover:text-lcs-text hover:bg-lcs-primary/10'
              }`}
              title="终端"
            >
              <Terminal className="w-4 h-4" />
            </button>
            <span className="text-xs text-lcs-muted">
              小码酱 Code v0.2.0
            </span>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden">
          {viewMode === 'chat' && (
            <div className="flex-1">
              <ChatPanel onCodeGenerated={handleCodeGenerated} />
            </div>
          )}
          
          {viewMode === 'code' && (
            <div className="flex-1">
              <CodeEditor onExecute={handleExecute} />
            </div>
          )}
          
          {viewMode === 'split' && (
            <>
              <div className="flex-1 border-r border-lcs-border">
                <ChatPanel onCodeGenerated={handleCodeGenerated} />
              </div>
              <div className="flex-1">
                <CodeEditor onExecute={handleExecute} />
              </div>
            </>
          )}
        </main>

        <TerminalPanel />
      </div>

      <SettingsPanel 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
      />

      <ToolConfirmDialog
        isOpen={pendingConfirmation !== null}
        toolId={pendingConfirmation?.toolId || ''}
        params={pendingConfirmation?.params || {}}
        onConfirm={(approved, remember) => handleConfirmDecision(approved, remember)}
      />
    </div>
  );
}

export default App;
