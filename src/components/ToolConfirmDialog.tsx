import { useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

interface ToolConfirmDialogProps {
  isOpen: boolean;
  toolId: string;
  params: Record<string, unknown>;
  onConfirm: (approved: boolean, remember?: boolean) => void;
}

const TOOL_NAMES: Record<string, string> = {
  read: '读取文件',
  write: '写入文件',
  edit: '编辑文件',
  delete: '删除文件',
  bash: '执行命令',
  webfetch: '网页抓取',
  websearch: '网络搜索',
  mcp_call: 'MCP 工具调用',
  code_execute: '代码执行',
  git: 'Git 操作',
};

export const ToolConfirmDialog: React.FC<ToolConfirmDialogProps> = ({
  isOpen,
  toolId,
  params,
  onConfirm,
}) => {
  const [remember, setRemember] = useState(false);

  if (!isOpen) return null;

  const toolName = TOOL_NAMES[toolId] || toolId;

  const formatParams = (p: Record<string, unknown>): string => {
    return Object.entries(p)
      .map(([key, value]) => {
        const strValue = typeof value === 'string' 
          ? (value.length > 100 ? value.slice(0, 100) + '...' : value)
          : JSON.stringify(value);
        return `${key}: ${strValue}`;
      })
      .join('\n');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-lcs-border bg-yellow-500/10">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
            <div>
              <h3 className="font-semibold text-lcs-text">工具执行确认</h3>
              <p className="text-sm text-lcs-muted">小码酱请求执行以下操作</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="text-sm text-lcs-muted mb-1">工具</div>
            <div className="font-medium text-lcs-text">{toolName}</div>
          </div>

          <div>
            <div className="text-sm text-lcs-muted mb-1">参数</div>
            <pre className="bg-lcs-surface p-3 rounded-lg text-sm text-lcs-text overflow-x-auto whitespace-pre-wrap">
              {formatParams(params)}
            </pre>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="remember-choice"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 rounded border-lcs-border text-lcs-primary focus:ring-lcs-primary"
            />
            <label htmlFor="remember-choice" className="text-sm text-lcs-muted">
              记住此选择（以后不再询问此工具）
            </label>
          </div>
        </div>

        <div className="p-4 border-t border-lcs-border flex gap-3">
          <button
            onClick={() => onConfirm(false, remember)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-lcs-surface border border-lcs-border rounded-lg text-lcs-text hover:bg-red-500/20 hover:border-red-500/50 transition-colors"
          >
            <X className="w-4 h-4" />
            拒绝
          </button>
          <button
            onClick={() => onConfirm(true, remember)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-lcs-primary to-lcs-secondary rounded-lg text-white hover:opacity-90 transition-opacity"
          >
            <Check className="w-4 h-4" />
            允许
          </button>
        </div>
      </div>
    </div>
  );
};
