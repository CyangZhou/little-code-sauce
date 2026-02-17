import React, { useState, useMemo, useEffect } from 'react';
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
  Plus,
  FolderPlus,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { realFileService } from '../services/realFileService';

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

function buildFileTree(files: { path: string; type: 'file' | 'directory' }[]): FileNode[] {
  const root: Map<string, FileNode> = new Map();
  const allPaths = new Set<string>();

  files.forEach(file => {
    const parts = file.path.split('/');
    let currentPath = '';
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      if (!allPaths.has(currentPath)) {
        allPaths.add(currentPath);
        
        const node: FileNode = {
          name: part,
          path: currentPath,
          type: isLast && file.type === 'file' ? 'file' : 'folder',
          ext: isLast && file.type === 'file' ? part.split('.').pop() : undefined,
        };
        
        if (isLast && file.type === 'directory') {
          node.children = [];
        }
        
        root.set(currentPath, node);
      }
    }
  });

  const result: FileNode[] = [];
  const childrenMap = new Map<string, FileNode[]>();

  root.forEach((node, path) => {
    const parentPath = path.split('/').slice(0, -1).join('/');
    
    if (parentPath) {
      if (!childrenMap.has(parentPath)) {
        childrenMap.set(parentPath, []);
      }
      childrenMap.get(parentPath)!.push(node);
    } else if (!path.includes('/')) {
      result.push(node);
    }
  });

  const assignChildren = (nodes: FileNode[]) => {
    nodes.forEach(node => {
      const children = childrenMap.get(node.path);
      if (children) {
        node.children = children;
        assignChildren(children);
      }
    });
  };

  assignChildren(result);

  return result.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

export const FileExplorer: React.FC = () => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const { openFile } = useAppStore();

  const workspace = realFileService.getWorkspace();

  useEffect(() => {
    const handleFileChange = () => {
      setRefreshKey(k => k + 1);
    };
    
    realFileService.addListener(handleFileChange);
    return () => realFileService.removeListener(handleFileChange);
  }, []);

  const fileNodes = useMemo(() => {
    void refreshKey;
    if (!workspace) return [];
    
    const fileTree = realFileService.getFileTree();
    return buildFileTree(fileTree);
  }, [workspace, refreshKey]);

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
    const content = realFileService.readFile(path);
    if (content !== null) {
      openFile(path);
    }
  };

  const handleCreateFile = () => {
    const fileName = prompt('请输入文件名:', 'new-file.ts');
    if (fileName) {
      realFileService.writeFile(fileName, '// 新文件\n');
      setRefreshKey(k => k + 1);
    }
  };

  const handleCreateFolder = () => {
    const folderName = prompt('请输入文件夹名:', 'new-folder');
    if (folderName) {
      realFileService.createDirectory(folderName);
      setRefreshKey(k => k + 1);
    }
  };

  const handleRefresh = async () => {
    await realFileService.refreshFromDirectory();
    setRefreshKey(k => k + 1);
  };

  const filteredFiles = useMemo(() => {
    if (!searchTerm) return fileNodes;
    
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
    
    return filterNodes(fileNodes);
  }, [searchTerm, fileNodes]);

  if (!workspace) {
    return (
      <div className="h-full flex flex-col bg-lcs-surface items-center justify-center p-4">
        <Folder className="w-12 h-12 text-lcs-muted mb-4" />
        <p className="text-sm text-lcs-muted text-center">
          没有打开的工作区
          <br />
          <br />
          请在聊天面板中创建或打开项目
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-lcs-surface">
      <div className="p-2 border-b border-lcs-border">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-lcs-text truncate flex-1" title={workspace.name}>
            📁 {workspace.name}
          </span>
          <button
            onClick={handleCreateFile}
            className="p-1 hover:bg-lcs-primary/20 rounded text-lcs-muted hover:text-lcs-text transition-colors"
            title="新建文件"
          >
            <Plus className="w-3 h-3" />
          </button>
          <button
            onClick={handleCreateFolder}
            className="p-1 hover:bg-lcs-primary/20 rounded text-lcs-muted hover:text-lcs-text transition-colors"
            title="新建文件夹"
          >
            <FolderPlus className="w-3 h-3" />
          </button>
          <button
            onClick={handleRefresh}
            className="p-1 hover:bg-lcs-primary/20 rounded text-lcs-muted hover:text-lcs-text transition-colors"
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
        {filteredFiles.length > 0 ? (
          filteredFiles.map((node) => (
            <FileTreeItem
              key={node.path}
              node={node}
              depth={0}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              onFileClick={handleFileClick}
              searchTerm={searchTerm}
            />
          ))
        ) : (
          <div className="text-center py-8 text-lcs-muted text-sm">
            <File className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>工作区为空</p>
            <p className="text-xs mt-1">点击 + 创建新文件</p>
          </div>
        )}
      </div>

      <div className="p-2 border-t border-lcs-border text-xs text-lcs-muted">
        {realFileService.listFiles().length} 个文件
      </div>
    </div>
  );
};
