import React, { useMemo } from 'react';
import { ChevronDown, ChevronUp, Plus, Minus, FileText } from 'lucide-react';

interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface DiffViewProps {
  oldContent: string;
  newContent: string;
  filename?: string;
  showLineNumbers?: boolean;
  contextLines?: number;
}

export function computeDiff(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const diff: DiffLine[] = [];
  
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);
  
  let oldIdx = 0;
  let newIdx = 0;
  
  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldLines[oldIdx];
    const newLine = newLines[newIdx];
    
    if (oldIdx >= oldLines.length) {
      diff.push({ type: 'add', content: newLine, newLineNumber: newIdx + 1 });
      newIdx++;
    } else if (newIdx >= newLines.length) {
      diff.push({ type: 'remove', content: oldLine, oldLineNumber: oldIdx + 1 });
      oldIdx++;
    } else if (oldLine === newLine) {
      diff.push({ 
        type: 'context', 
        content: oldLine, 
        oldLineNumber: oldIdx + 1,
        newLineNumber: newIdx + 1 
      });
      oldIdx++;
      newIdx++;
    } else if (!newSet.has(oldLine)) {
      diff.push({ type: 'add', content: newLine, newLineNumber: newIdx + 1 });
      newIdx++;
    } else if (!oldSet.has(newLine)) {
      diff.push({ type: 'remove', content: oldLine, oldLineNumber: oldIdx + 1 });
      oldIdx++;
    } else {
      diff.push({ type: 'remove', content: oldLine, oldLineNumber: oldIdx + 1 });
      diff.push({ type: 'add', content: newLine, newLineNumber: newIdx + 1 });
      oldIdx++;
      newIdx++;
    }
  }
  
  return diff;
}

export const DiffView: React.FC<DiffViewProps> = ({
  oldContent,
  newContent,
  filename,
  showLineNumbers = true,
}) => {
  const diff = useMemo(() => computeDiff(oldContent, newContent), [oldContent, newContent]);
  
  const stats = useMemo(() => {
    const added = diff.filter(l => l.type === 'add').length;
    const removed = diff.filter(l => l.type === 'remove').length;
    return { added, removed };
  }, [diff]);

  return (
    <div className="diff-view bg-lcs-surface rounded-lg overflow-hidden border border-lcs-border">
      {filename && (
        <div className="diff-header flex items-center justify-between px-3 py-2 bg-lcs-bg border-b border-lcs-border">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-lcs-muted" />
            <span className="text-sm text-lcs-text font-medium">{filename}</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-green-400">
              <Plus className="w-3 h-3" />
              {stats.added}
            </span>
            <span className="flex items-center gap-1 text-red-400">
              <Minus className="w-3 h-3" />
              {stats.removed}
            </span>
          </div>
        </div>
      )}
      
      <div className="diff-content overflow-x-auto">
        {diff.map((line, idx) => (
          <div
            key={idx}
            className={`diff-line flex font-mono text-xs ${
              line.type === 'add' 
                ? 'bg-green-500/10' 
                : line.type === 'remove' 
                  ? 'bg-red-500/10' 
                  : ''
            }`}
          >
            {showLineNumbers && (
              <div className="line-numbers flex shrink-0">
                <span className={`w-10 px-2 text-right border-r border-lcs-border ${
                  line.type === 'add' ? 'text-green-400/50' : 
                  line.type === 'remove' ? 'text-red-400/50' : 
                  'text-lcs-muted/50'
                }`}>
                  {line.oldLineNumber || ''}
                </span>
                <span className={`w-10 px-2 text-right border-r border-lcs-border ${
                  line.type === 'add' ? 'text-green-400/50' : 
                  line.type === 'remove' ? 'text-red-400/50' : 
                  'text-lcs-muted/50'
                }`}>
                  {line.newLineNumber || ''}
                </span>
              </div>
            )}
            <span className={`px-2 shrink-0 ${
              line.type === 'add' ? 'text-green-400' : 
              line.type === 'remove' ? 'text-red-400' : 
              ''
            }`}>
              {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
            </span>
            <pre className={`px-2 flex-1 whitespace-pre ${
              line.type === 'add' ? 'text-green-300' : 
              line.type === 'remove' ? 'text-red-300' : 
              'text-lcs-text'
            }`}>
              {line.content || ' '}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
};

interface DiffPreviewProps {
  changes: Array<{
    filename: string;
    oldContent: string;
    newContent: string;
  }>;
  onAccept?: () => void;
  onReject?: () => void;
}

export const DiffPreview: React.FC<DiffPreviewProps> = ({ changes, onAccept, onReject }) => {
  const [expandedFiles, setExpandedFiles] = React.useState<Set<string>>(new Set(changes.map(c => c.filename)));

  const toggleFile = (filename: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
      }
      return next;
    });
  };

  return (
    <div className="diff-preview space-y-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-lcs-text">变更预览</h3>
        <div className="flex gap-2">
          {onReject && (
            <button
              onClick={onReject}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
            >
              拒绝更改
            </button>
          )}
          {onAccept && (
            <button
              onClick={onAccept}
              className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors"
            >
              接受更改
            </button>
          )}
        </div>
      </div>

      {changes.map((change) => (
        <div key={change.filename} className="border border-lcs-border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleFile(change.filename)}
            className="w-full flex items-center justify-between px-3 py-2 bg-lcs-bg hover:bg-lcs-surface transition-colors"
          >
            <span className="text-sm text-lcs-text">{change.filename}</span>
            {expandedFiles.has(change.filename) ? (
              <ChevronUp className="w-4 h-4 text-lcs-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-lcs-muted" />
            )}
          </button>
          
          {expandedFiles.has(change.filename) && (
            <DiffView
              oldContent={change.oldContent}
              newContent={change.newContent}
              filename=""
            />
          )}
        </div>
      ))}
    </div>
  );
};
