import React, { useState, useMemo } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  FolderOpen, 
  Search,
  RefreshCw,
  FileCode,
  FileJson,
  FileText,
  Image,
  FileSpreadsheet,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  ext?: string;
}

const FILE_ICONS: Record<string, React.ReactNode> = {
  ts: <FileCode className="w-4 h-4 text-blue-400" />,
  tsx: <FileCode className="w-4 h-4 text-blue-400" />,
  js: <FileCode className="w-4 h-4 text-yellow-400" />,
  jsx: <FileCode className="w-4 h-4 text-yellow-400" />,
  json: <FileJson className="w-4 h-4 text-yellow-500" />,
  md: <FileText className="w-4 h-4 text-gray-400" />,
  css: <FileText className="w-4 h-4 text-pink-400" />,
  html: <FileText className="w-4 h-4 text-orange-400" />,
  py: <FileCode className="w-4 h-4 text-green-400" />,
  rs: <FileCode className="w-4 h-4 text-orange-500" />,
  go: <FileCode className="w-4 h-4 text-cyan-400" />,
  png: <Image className="w-4 h-4 text-purple-400" />,
  jpg: <Image className="w-4 h-4 text-purple-400" />,
  svg: <Image className="w-4 h-4 text-purple-400" />,
  xlsx: <FileSpreadsheet className="w-4 h-4 text-green-500" />,
  csv: <FileSpreadsheet className="w-4 h-4 text-green-500" />,
};

const DEFAULT_PROJECT_FILES: FileNode[] = [
  {
    name: 'src',
    path: 'src',
    type: 'folder',
    children: [
      {
        name: 'components',
        path: 'src/components',
        type: 'folder',
        children: [
          { name: 'App.tsx', path: 'src/components/App.tsx', type: 'file', ext: 'tsx' },
          { name: 'ChatPanel.tsx', path: 'src/components/ChatPanel.tsx', type: 'file', ext: 'tsx' },
          { name: 'CodeEditor.tsx', path: 'src/components/CodeEditor.tsx', type: 'file', ext: 'tsx' },
          { name: 'Sidebar.tsx', path: 'src/components/Sidebar.tsx', type: 'file', ext: 'tsx' },
          { name: 'TerminalPanel.tsx', path: 'src/components/TerminalPanel.tsx', type: 'file', ext: 'tsx' },
        ],
      },
      {
        name: 'services',
        path: 'src/services',
        type: 'folder',
        children: [
          { name: 'llm.ts', path: 'src/services/llm.ts', type: 'file', ext: 'ts' },
          { name: 'mcp.ts', path: 'src/services/mcp.ts', type: 'file', ext: 'ts' },
          { name: 'toolExecution.ts', path: 'src/services/toolExecution.ts', type: 'file', ext: 'ts' },
          { name: 'slashCommands.ts', path: 'src/services/slashCommands.ts', type: 'file', ext: 'ts' },
          { name: 'fileReference.ts', path: 'src/services/fileReference.ts', type: 'file', ext: 'ts' },
        ],
      },
      {
        name: 'store',
        path: 'src/store',
        type: 'folder',
        children: [
          { name: 'useAppStore.ts', path: 'src/store/useAppStore.ts', type: 'file', ext: 'ts' },
        ],
      },
      {
        name: 'core',
        path: 'src/core',
        type: 'folder',
        children: [
          { name: 'soul.ts', path: 'src/core/soul.ts', type: 'file', ext: 'ts' },
        ],
      },
      { name: 'App.tsx', path: 'src/App.tsx', type: 'file', ext: 'tsx' },
      { name: 'main.tsx', path: 'src/main.tsx', type: 'file', ext: 'tsx' },
      { name: 'index.css', path: 'src/index.css', type: 'file', ext: 'css' },
    ],
  },
  {
    name: 'public',
    path: 'public',
    type: 'folder',
    children: [
      { name: 'vite.svg', path: 'public/vite.svg', type: 'file', ext: 'svg' },
    ],
  },
  { name: 'package.json', path: 'package.json', type: 'file', ext: 'json' },
  { name: 'tsconfig.json', path: 'tsconfig.json', type: 'file', ext: 'json' },
  { name: 'vite.config.ts', path: 'vite.config.ts', type: 'file', ext: 'ts' },
  { name: 'README.md', path: 'README.md', type: 'file', ext: 'md' },
];

interface FileTreeItemProps {
  node: FileNode;
  depth: number;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
  onFileClick: (path: string) => void;
  searchTerm: string;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({
  node,
  depth,
  expandedFolders,
  toggleFolder,
  onFileClick,
  searchTerm,
}) => {
  const isExpanded = expandedFolders.has(node.path);
  const isFolder = node.type === 'folder';
  const matchesSearch = searchTerm && node.name.toLowerCase().includes(searchTerm.toLowerCase());
  
  const handleClick = () => {
    if (isFolder) {
      toggleFolder(node.path);
    } else {
      onFileClick(node.path);
    }
  };

  const getFileIcon = () => {
    if (isFolder) {
      return isExpanded ? (
        <FolderOpen className="w-4 h-4 text-lcs-primary" />
      ) : (
        <Folder className="w-4 h-4 text-lcs-primary" />
      );
    }
    
    if (node.ext && FILE_ICONS[node.ext]) {
      return FILE_ICONS[node.ext];
    }
    
    return <File className="w-4 h-4 text-lcs-muted" />;
  };

  return (
    <div>
      <div
        onClick={handleClick}
        className={`flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-lcs-primary/10 rounded transition-colors ${
          matchesSearch ? 'bg-lcs-primary/20' : ''
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isFolder && (
          <span className="w-4 h-4 flex items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-lcs-muted" />
            ) : (
              <ChevronRight className="w-3 h-3 text-lcs-muted" />
            )}
          </span>
        )}
        {!isFolder && <span className="w-4" />}
        {getFileIcon()}
        <span className={`text-sm truncate ${matchesSearch ? 'text-lcs-primary font-medium' : 'text-lcs-text'}`}>
          {node.name}
        </span>
      </div>
      
      {isFolder && isExpanded && node.children && (
        <div>
          {node.children
            .sort((a, b) => {
              if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
              }
              return a.name.localeCompare(b.name);
            })
            .map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
                onFileClick={onFileClick}
                searchTerm={searchTerm}
              />
            ))}
        </div>
      )}
    </div>
  );
};

export const FileExplorer: React.FC = () => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src']));
  const [searchTerm, setSearchTerm] = useState('');
  const { openFile } = useAppStore();

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleFileClick = (path: string) => {
    openFile(path);
  };

  const filteredFiles = useMemo(() => {
    if (!searchTerm) return DEFAULT_PROJECT_FILES;
    
    const filterNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes.reduce<FileNode[]>((acc, node) => {
        if (node.name.toLowerCase().includes(searchTerm.toLowerCase())) {
          acc.push(node);
        } else if (node.children) {
          const filteredChildren = filterNodes(node.children);
          if (filteredChildren.length > 0) {
            acc.push({ ...node, children: filteredChildren });
          }
        }
        return acc;
      }, []);
    };
    
    return filterNodes(DEFAULT_PROJECT_FILES);
  }, [searchTerm]);

  return (
    <div className="h-full flex flex-col bg-lcs-surface">
      <div className="p-2 border-b border-lcs-border">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-lcs-text">文件浏览器</span>
          <button
            onClick={() => setExpandedFolders(new Set(['src']))}
            className="p-1 hover:bg-lcs-primary/20 rounded text-lcs-muted hover:text-lcs-text transition-colors ml-auto"
            title="刷新"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-lcs-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索文件..."
            className="w-full pl-7 pr-2 py-1 bg-lcs-bg border border-lcs-border rounded text-xs text-lcs-text placeholder-lcs-muted focus:outline-none focus:border-lcs-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {filteredFiles.map((node) => (
          <FileTreeItem
            key={node.path}
            node={node}
            depth={0}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
            onFileClick={handleFileClick}
            searchTerm={searchTerm}
          />
        ))}
      </div>

      <div className="p-2 border-t border-lcs-border text-xs text-lcs-muted">
        点击文件在编辑器中打开
      </div>
    </div>
  );
};
