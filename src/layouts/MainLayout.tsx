import React, { useState } from 'react';
import { PanelLeftClose, PanelLeft, Code2, MessageSquare, Terminal, FolderOpen } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { FileExplorer } from '../components/FileExplorer';
import { useAppStore } from '../store/useAppStore';
import { ChatPanel } from '../components/ChatPanel';
import { CodeEditor } from '../components/CodeEditor';
import { TerminalPanel } from '../components/TerminalPanel';
import { SettingsPanel } from '../components/SettingsPanel';

type ViewMode = 'chat' | 'code' | 'split';

export const MainLayout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fileExplorerOpen, setFileExplorerOpen] = useState(true);
  
  const { openFile, terminal, toggleTerminal } = useAppStore();

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
    <div className="h-screen flex bg-lcs-bg overflow-hidden font-sans text-lcs-text">
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      
      {fileExplorerOpen && (
        <div className="w-64 border-r border-lcs-border flex-shrink-0 bg-white/50 backdrop-blur-sm">
          <FileExplorer />
        </div>
      )}
      
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-14 bg-white/80 backdrop-blur-md border-b border-lcs-border flex items-center justify-between px-4 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 hover:bg-lcs-muted/10 rounded-md text-lcs-muted hover:text-lcs-text transition-colors"
            >
              {sidebarCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setFileExplorerOpen(!fileExplorerOpen)}
              className={`p-2 rounded-md transition-colors ${
                fileExplorerOpen 
                  ? 'bg-lcs-primary-light text-lcs-primary' 
                  : 'text-lcs-muted hover:text-lcs-text hover:bg-lcs-muted/10'
              }`}
              title="文件浏览器"
            >
              <FolderOpen className="w-5 h-5" />
            </button>
            
            <div className="h-6 w-px bg-lcs-border mx-2" />
            
            <div className="flex items-center bg-lcs-muted/5 rounded-lg p-1 border border-lcs-border/50">
              <button
                onClick={() => setViewMode('chat')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'chat' 
                    ? 'bg-white text-lcs-primary shadow-sm' 
                    : 'text-lcs-muted hover:text-lcs-text'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  <span>对话</span>
                </div>
              </button>
              <button
                onClick={() => setViewMode('code')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'code' 
                    ? 'bg-white text-lcs-primary shadow-sm' 
                    : 'text-lcs-muted hover:text-lcs-text'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4" />
                  <span>代码</span>
                </div>
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'split' 
                    ? 'bg-white text-lcs-primary shadow-sm' 
                    : 'text-lcs-muted hover:text-lcs-text'
                }`}
              >
                分屏
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTerminal}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors border ${
                terminal.visible 
                  ? 'bg-lcs-primary-light text-lcs-primary border-lcs-primary/20' 
                  : 'text-lcs-muted hover:text-lcs-text border-transparent hover:bg-lcs-muted/5'
              }`}
              title="终端"
            >
              <Terminal className="w-4 h-4" />
              <span className="text-sm font-medium">终端</span>
            </button>
            <div className="text-xs font-mono text-lcs-muted/50 px-2 py-1 rounded bg-lcs-muted/5 border border-lcs-border/50">
              Little Code Sauce v0.3
            </div>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden relative">
          {viewMode === 'chat' && (
            <div className="flex-1 bg-lcs-bg">
              <ChatPanel onCodeGenerated={handleCodeGenerated} />
            </div>
          )}
          
          {viewMode === 'code' && (
            <div className="flex-1 bg-white">
              <CodeEditor onExecute={handleExecute} />
            </div>
          )}
          
          {viewMode === 'split' && (
            <>
              <div className="flex-1 border-r border-lcs-border bg-lcs-bg">
                <ChatPanel onCodeGenerated={handleCodeGenerated} />
              </div>
              <div className="flex-1 bg-white">
                <CodeEditor onExecute={handleExecute} />
              </div>
            </>
          )}

          {terminal.visible && (
            <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-white border-t border-lcs-border z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
               <TerminalPanel />
            </div>
          )}
        </main>
      </div>

      {settingsOpen && <SettingsPanel isOpen={true} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
};
