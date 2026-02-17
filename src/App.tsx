import { useEffect, useCallback, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { toolExecutionService } from './services/toolExecution';
import { permissionService } from './services/permission';
import { fileReferenceManager } from './services/fileReference';
import { MainLayout } from './layouts/MainLayout';
import { ToolConfirmDialog } from './components/ToolConfirmDialog';

interface PendingConfirmation {
  toolId: string;
  params: Record<string, unknown>;
  resolve: (approved: boolean) => void;
}

function App() {
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const { setProjectFiles } = useAppStore();

  useEffect(() => {
    const projectFiles = [
      'src/App.tsx',
      'src/main.tsx',
      'src/index.css',
      'src/layouts/MainLayout.tsx',
      'src/components/ChatPanel.tsx',
      'src/components/CodeEditor.tsx',
      'src/components/Sidebar.tsx',
      'package.json',
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

  return (
    <>
      <MainLayout />
      {pendingConfirmation && (
        <ToolConfirmDialog
          isOpen={true}
          toolId={pendingConfirmation.toolId}
          params={pendingConfirmation.params}
          onConfirm={(approved, remember) => handleConfirmDecision(approved, remember)}
        />
      )}
    </>
  );
}

export default App;
