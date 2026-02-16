import { useState, useEffect } from 'react';
import { 
  X, Key, Globe, Save, Check, Eye, EyeOff, AlertCircle, CheckCircle,
  User, FolderKanban, Puzzle, Server, Plus, Trash2, Search,
  Download, Copy, Sparkles, Shield, RotateCcw, Zap, TrendingUp, Calendar
} from 'lucide-react';
import { llmService } from '../services/llm';
import type { LLMConfig } from '../services/llm';
import { soulCoreService } from '../services/soulCore';
import type { SoulRule, ProjectConfig, MCPServerConfig } from '../services/soulCore';
import { mcpService, BUILTIN_MCP_SERVERS } from '../services/mcp';
import { skillService } from '../services/skill';
import type { SkillMarketItem, SkillManifest } from '../services/skill';
import { permissionService } from '../services/permission';
import type { ToolDefinition, PermissionMode } from '../services/permission';
import { tokenTrackerService } from '../services/tokenTracker';
import type { TokenUsageSummary } from '../services/tokenTracker';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'llm' | 'soul' | 'rules' | 'mcp' | 'skills' | 'projects' | 'permissions' | 'tokens';

const API_PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-coder'] },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { id: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] },
  { id: 'local', name: '本地模型 (Ollama)', baseUrl: 'http://localhost:11434/v1', models: ['llama3', 'mistral', 'codellama'] },
  { id: 'custom', name: '自定义', baseUrl: '', models: [] },
];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('llm');
  
  const [llmConfig, setLlmConfig] = useState<LLMConfig>({
    provider: 'deepseek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const [corePrompt, setCorePrompt] = useState('');
  const [personalRules, setPersonalRules] = useState<SoulRule[]>([]);
  const [projectRules, setProjectRules] = useState<SoulRule[]>([]);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleContent, setNewRuleContent] = useState('');
  const [newRuleType, setNewRuleType] = useState<'personal' | 'project'>('personal');

  const [mcpServers, setMcpServers] = useState<MCPServerConfig[]>([]);
  const [showMcpForm, setShowMcpForm] = useState(false);
  const [newMcp, setNewMcp] = useState({
    name: '',
    command: '',
    args: '',
    env: '',
  });

  const [skills, setSkills] = useState<SkillMarketItem[]>([]);
  const [installedSkills, setInstalledSkills] = useState<SkillManifest[]>([]);
  const [skillSearch, setSkillSearch] = useState('');

  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [permissions, setPermissions] = useState<Record<string, PermissionMode>>({});

  const [tokenSummary, setTokenSummary] = useState<TokenUsageSummary | null>(null);
  const [tokenDays, setTokenDays] = useState(7);

  useEffect(() => {
    if (isOpen) {
      loadAllConfigs();
    }
  }, [isOpen]);

  const loadAllConfigs = () => {
    const savedLlmConfig = localStorage.getItem('lcs-llm-config');
    if (savedLlmConfig) {
      try {
        setLlmConfig(JSON.parse(savedLlmConfig));
      } catch (e) {
        console.error('Failed to parse LLM config:', e);
      }
    }

    const soulConfig = soulCoreService.getSoulConfig();
    setCorePrompt(soulConfig.corePrompt);
    setPersonalRules(soulConfig.personalRules);
    setProjectRules(soulConfig.projectRules);
    setActiveProjectId(soulConfig.activeProjectId);

    setMcpServers(soulCoreService.getMCPServers());
    setProjects(soulCoreService.getProjects());
    setInstalledSkills(skillService.getInstalledSkills());
    setSkills(skillService.getMarketSkills());
    setTools(permissionService.getTools());
    setPermissions(permissionService.getAllPermissions());
    setTokenSummary(tokenTrackerService.getSummary(tokenDays));
  };

  const handleSaveLlm = () => {
    localStorage.setItem('lcs-llm-config', JSON.stringify(llmConfig));
    llmService.setConfig(llmConfig);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestLlm = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      llmService.setConfig(llmConfig);
      const response = await llmService.chat([{ role: 'user', content: '你好' }]);
      setTestResult(response && !response.includes('错误') ? 'success' : 'error');
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveCorePrompt = () => {
    soulCoreService.setCorePrompt(corePrompt);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAddRule = () => {
    if (!newRuleName.trim() || !newRuleContent.trim()) return;
    soulCoreService.addRule({
      name: newRuleName,
      content: newRuleContent,
      enabled: true,
      type: newRuleType,
    });
    const config = soulCoreService.getSoulConfig();
    setPersonalRules(config.personalRules);
    setProjectRules(config.projectRules);
    setNewRuleName('');
    setNewRuleContent('');
  };

  const handleDeleteRule = (id: string) => {
    soulCoreService.deleteRule(id);
    const config = soulCoreService.getSoulConfig();
    setPersonalRules(config.personalRules);
    setProjectRules(config.projectRules);
  };

  const handleToggleRule = (id: string) => {
    soulCoreService.toggleRule(id);
    const config = soulCoreService.getSoulConfig();
    setPersonalRules(config.personalRules);
    setProjectRules(config.projectRules);
  };

  const handleAddMcpServer = () => {
    if (!newMcp.name || !newMcp.command) return;
    soulCoreService.addMCPServer({
      name: newMcp.name,
      command: newMcp.command,
      args: newMcp.args.split(' ').filter(Boolean),
      env: newMcp.env ? JSON.parse(newMcp.env) : {},
      enabled: true,
    });
    setMcpServers(soulCoreService.getMCPServers());
    setNewMcp({ name: '', command: '', args: '', env: '' });
    setShowMcpForm(false);
  };

  const handleAddBuiltinMcp = (builtin: typeof BUILTIN_MCP_SERVERS[0]) => {
    soulCoreService.addMCPServer({
      name: builtin.name,
      command: builtin.command,
      args: builtin.args,
      env: {},
      enabled: true,
    });
    setMcpServers(soulCoreService.getMCPServers());
  };

  const handleDeleteMcpServer = (id: string) => {
    soulCoreService.deleteMCPServer(id);
    setMcpServers(soulCoreService.getMCPServers());
  };

  const handleInstallSkill = (skillId: string) => {
    skillService.installSkill(skillId);
    setInstalledSkills(skillService.getInstalledSkills());
    setSkills(skillService.getMarketSkills());
  };

  const handleUninstallSkill = (skillId: string) => {
    skillService.uninstallSkill(skillId);
    setInstalledSkills(skillService.getInstalledSkills());
    setSkills(skillService.getMarketSkills());
  };

  const handleExportConfig = () => {
    const config = {
      llm: llmConfig,
      soul: soulCoreService.getSoulConfig(),
      mcp: soulCoreService.getMCPServers(),
      skills: skillService.getInstalledSkills(),
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `little-code-sauce-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyMcpConfig = () => {
    const config = mcpService.generateClaudeConfig(
      mcpServers.filter(s => s.enabled).map(s => ({
        name: s.name,
        displayName: s.name,
        description: '',
        command: s.command,
        args: s.args,
        env: s.env,
      }))
    );
    navigator.clipboard.writeText(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!isOpen) return null;

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'llm', label: 'API配置', icon: <Key className="w-4 h-4" /> },
    { id: 'soul', label: '灵魂核心', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'rules', label: '规则管理', icon: <User className="w-4 h-4" /> },
    { id: 'mcp', label: 'MCP配置', icon: <Server className="w-4 h-4" /> },
    { id: 'skills', label: '技能市场', icon: <Puzzle className="w-4 h-4" /> },
    { id: 'projects', label: '项目管理', icon: <FolderKanban className="w-4 h-4" /> },
    { id: 'permissions', label: '权限管理', icon: <Shield className="w-4 h-4" /> },
    { id: 'tokens', label: 'Token统计', icon: <Zap className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-lcs-border shrink-0">
          <h2 className="text-xl font-bold bg-gradient-to-r from-lcs-primary to-lcs-secondary bg-clip-text text-transparent">
            小码酱设置
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportConfig}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-lcs-surface border border-lcs-border rounded-lg text-lcs-text hover:bg-lcs-primary/20 transition-colors"
            >
              <Download className="w-3 h-3" />
              导出配置
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-lcs-surface rounded-lg text-lcs-muted hover:text-lcs-text transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-48 bg-lcs-surface/50 border-r border-lcs-border p-2 shrink-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors mb-1 ${
                  activeTab === tab.id
                    ? 'bg-lcs-primary/20 text-lcs-primary'
                    : 'text-lcs-text hover:bg-lcs-surface'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'llm' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-lcs-text mb-2">
                    <Globe className="w-4 h-4 inline mr-2" />
                    API 提供商
                  </label>
                  <select
                    value={llmConfig.provider}
                    onChange={(e) => {
                      const provider = API_PROVIDERS.find(p => p.id === e.target.value);
                      if (provider) {
                        setLlmConfig(prev => ({
                          ...prev,
                          provider: e.target.value as LLMConfig['provider'],
                          baseUrl: provider.baseUrl,
                          model: provider.models[0] || '',
                        }));
                      }
                    }}
                    className="w-full bg-lcs-surface border border-lcs-border rounded-lg px-4 py-2 text-lcs-text focus:outline-none focus:border-lcs-primary"
                  >
                    {API_PROVIDERS.map(provider => (
                      <option key={provider.id} value={provider.id}>{provider.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-lcs-text mb-2">API 地址</label>
                  <input
                    type="text"
                    value={llmConfig.baseUrl}
                    onChange={(e) => setLlmConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                    className="w-full bg-lcs-surface border border-lcs-border rounded-lg px-4 py-2 text-lcs-text focus:outline-none focus:border-lcs-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-lcs-text mb-2">API 密钥</label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={llmConfig.apiKey || ''}
                      onChange={(e) => setLlmConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                      className="w-full bg-lcs-surface border border-lcs-border rounded-lg px-4 py-2 pr-10 text-lcs-text focus:outline-none focus:border-lcs-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-lcs-muted hover:text-lcs-text"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-lcs-text mb-2">模型</label>
                  <input
                    type="text"
                    value={llmConfig.model || ''}
                    onChange={(e) => setLlmConfig(prev => ({ ...prev, model: e.target.value }))}
                    className="w-full bg-lcs-surface border border-lcs-border rounded-lg px-4 py-2 text-lcs-text focus:outline-none focus:border-lcs-primary"
                  />
                </div>

                {testResult && (
                  <div className={`flex items-center gap-2 p-3 rounded-lg ${
                    testResult === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {testResult === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    {testResult === 'success' ? '连接成功！' : '连接失败，请检查配置'}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={handleTestLlm} disabled={testing || !llmConfig.apiKey}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-lcs-surface border border-lcs-border rounded-lg text-lcs-text hover:bg-lcs-primary/20 disabled:opacity-50 transition-colors">
                    {testing ? '测试中...' : '测试连接'}
                  </button>
                  <button onClick={handleSaveLlm}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-lcs-primary to-lcs-secondary rounded-lg text-white hover:opacity-90 transition-opacity">
                    {saved ? <><Check className="w-4 h-4" /> 已保存</> : <><Save className="w-4 h-4" /> 保存配置</>}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'soul' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-lcs-text">灵魂核心 Prompt</h3>
                  <button onClick={handleSaveCorePrompt}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-lcs-primary to-lcs-secondary rounded-lg text-white text-sm hover:opacity-90">
                    <Save className="w-3 h-3" /> 保存
                  </button>
                </div>
                <textarea
                  value={corePrompt}
                  onChange={(e) => setCorePrompt(e.target.value)}
                  className="w-full h-96 bg-lcs-surface border border-lcs-border rounded-lg px-4 py-3 text-lcs-text text-sm font-mono focus:outline-none focus:border-lcs-primary resize-none"
                  placeholder="编辑小码酱的灵魂核心..."
                />
                <div className="text-xs text-lcs-muted">
                  这是小码酱的核心人设和行为准则。修改后保存即可生效。
                </div>
              </div>
            )}

            {activeTab === 'rules' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-lcs-text">个人规则</h3>
                  {personalRules.map(rule => (
                    <div key={rule.id} className="flex items-start gap-3 p-3 bg-lcs-surface rounded-lg border border-lcs-border">
                      <input type="checkbox" checked={rule.enabled} onChange={() => handleToggleRule(rule.id)}
                        className="mt-1 w-4 h-4 rounded border-lcs-border text-lcs-primary focus:ring-lcs-primary" />
                      <div className="flex-1">
                        <div className="font-medium text-lcs-text">{rule.name}</div>
                        <div className="text-sm text-lcs-muted mt-1">{rule.content.slice(0, 100)}...</div>
                      </div>
                      <button onClick={() => handleDeleteRule(rule.id)} className="p-1 text-lcs-muted hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-lcs-text">项目规则</h3>
                  {projectRules.map(rule => (
                    <div key={rule.id} className="flex items-start gap-3 p-3 bg-lcs-surface rounded-lg border border-lcs-border">
                      <input type="checkbox" checked={rule.enabled} onChange={() => handleToggleRule(rule.id)}
                        className="mt-1 w-4 h-4 rounded border-lcs-border text-lcs-primary focus:ring-lcs-primary" />
                      <div className="flex-1">
                        <div className="font-medium text-lcs-text">{rule.name}</div>
                        <div className="text-sm text-lcs-muted mt-1">{rule.content.slice(0, 100)}...</div>
                      </div>
                      <button onClick={() => handleDeleteRule(rule.id)} className="p-1 text-lcs-muted hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-lcs-surface rounded-lg border border-lcs-border space-y-3">
                  <h4 className="font-medium text-lcs-text">添加新规则</h4>
                  <div className="flex gap-2">
                    <select value={newRuleType} onChange={(e) => setNewRuleType(e.target.value as 'personal' | 'project')}
                      className="bg-lcs-bg border border-lcs-border rounded-lg px-3 py-2 text-lcs-text text-sm">
                      <option value="personal">个人规则</option>
                      <option value="project">项目规则</option>
                    </select>
                    <input type="text" value={newRuleName} onChange={(e) => setNewRuleName(e.target.value)}
                      placeholder="规则名称" className="flex-1 bg-lcs-bg border border-lcs-border rounded-lg px-3 py-2 text-lcs-text text-sm" />
                  </div>
                  <textarea value={newRuleContent} onChange={(e) => setNewRuleContent(e.target.value)}
                    placeholder="规则内容..." className="w-full h-24 bg-lcs-bg border border-lcs-border rounded-lg px-3 py-2 text-lcs-text text-sm resize-none" />
                  <button onClick={handleAddRule}
                    className="flex items-center gap-1 px-4 py-2 bg-lcs-primary/20 text-lcs-primary rounded-lg text-sm hover:bg-lcs-primary/30">
                    <Plus className="w-4 h-4" /> 添加规则
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'mcp' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-lcs-text">MCP 服务器配置</h3>
                  <div className="flex gap-2">
                    <button onClick={copyMcpConfig}
                      className="flex items-center gap-1 px-3 py-1.5 bg-lcs-surface border border-lcs-border rounded-lg text-lcs-text text-sm hover:bg-lcs-primary/20">
                      <Copy className="w-3 h-3" /> 复制配置
                    </button>
                    <button onClick={() => setShowMcpForm(!showMcpForm)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-lcs-primary to-lcs-secondary rounded-lg text-white text-sm">
                      <Plus className="w-3 h-3" /> 添加服务器
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {BUILTIN_MCP_SERVERS.map(builtin => (
                    <button key={builtin.name} onClick={() => handleAddBuiltinMcp(builtin)}
                      className="p-3 bg-lcs-surface rounded-lg border border-lcs-border text-left hover:border-lcs-primary/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{builtin.icon}</span>
                        <div>
                          <div className="font-medium text-lcs-text">{builtin.displayName}</div>
                          <div className="text-xs text-lcs-muted">{builtin.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {mcpServers.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-lcs-text">已配置的服务器</h4>
                    {mcpServers.map(server => (
                      <div key={server.id} className="flex items-center justify-between p-3 bg-lcs-surface rounded-lg border border-lcs-border">
                        <div>
                          <div className="font-medium text-lcs-text">{server.name}</div>
                          <div className="text-xs text-lcs-muted">{server.command} {server.args.join(' ')}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={server.enabled}
                            onChange={() => {
                              soulCoreService.updateMCPServer(server.id, { enabled: !server.enabled });
                              setMcpServers(soulCoreService.getMCPServers());
                            }}
                            className="w-4 h-4 rounded border-lcs-border text-lcs-primary" />
                          <button onClick={() => handleDeleteMcpServer(server.id)} className="p-1 text-lcs-muted hover:text-red-400">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {showMcpForm && (
                  <div className="p-4 bg-lcs-surface rounded-lg border border-lcs-border space-y-3">
                    <h4 className="font-medium text-lcs-text">自定义 MCP 服务器</h4>
                    <input type="text" value={newMcp.name} onChange={(e) => setNewMcp(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="服务器名称" className="w-full bg-lcs-bg border border-lcs-border rounded-lg px-3 py-2 text-lcs-text text-sm" />
                    <input type="text" value={newMcp.command} onChange={(e) => setNewMcp(prev => ({ ...prev, command: e.target.value }))}
                      placeholder="命令 (如: npx)" className="w-full bg-lcs-bg border border-lcs-border rounded-lg px-3 py-2 text-lcs-text text-sm" />
                    <input type="text" value={newMcp.args} onChange={(e) => setNewMcp(prev => ({ ...prev, args: e.target.value }))}
                      placeholder="参数 (空格分隔)" className="w-full bg-lcs-bg border border-lcs-border rounded-lg px-3 py-2 text-lcs-text text-sm" />
                    <input type="text" value={newMcp.env} onChange={(e) => setNewMcp(prev => ({ ...prev, env: e.target.value }))}
                      placeholder="环境变量 (JSON格式)" className="w-full bg-lcs-bg border border-lcs-border rounded-lg px-3 py-2 text-lcs-text text-sm" />
                    <div className="flex gap-2">
                      <button onClick={() => setShowMcpForm(false)} className="px-4 py-2 bg-lcs-bg border border-lcs-border rounded-lg text-lcs-text text-sm">取消</button>
                      <button onClick={handleAddMcpServer} className="px-4 py-2 bg-gradient-to-r from-lcs-primary to-lcs-secondary rounded-lg text-white text-sm">添加</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'skills' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-lcs-muted" />
                    <input type="text" value={skillSearch} onChange={(e) => setSkillSearch(e.target.value)}
                      placeholder="搜索技能..." className="w-full bg-lcs-surface border border-lcs-border rounded-lg pl-10 pr-4 py-2 text-lcs-text text-sm" />
                  </div>
                </div>

                {installedSkills.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-lcs-text">已安装技能</h4>
                    {installedSkills.map(skill => (
                      <div key={skill.id} className="flex items-center justify-between p-3 bg-lcs-surface rounded-lg border border-lcs-border">
                        <div>
                          <div className="font-medium text-lcs-text">{skill.name}</div>
                          <div className="text-xs text-lcs-muted">{skill.description}</div>
                        </div>
                        <button onClick={() => handleUninstallSkill(skill.id)} className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30">
                          卸载
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="font-medium text-lcs-text">技能市场</h4>
                  {skills.filter(s => !s.installed).map(skill => (
                    <div key={skill.id} className="flex items-center justify-between p-3 bg-lcs-surface rounded-lg border border-lcs-border">
                      <div>
                        <div className="font-medium text-lcs-text">{skill.name}</div>
                        <div className="text-xs text-lcs-muted">{skill.description}</div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-lcs-muted">
                          <span>⭐ {skill.stars}</span>
                          <span>📥 {skill.downloads}</span>
                        </div>
                      </div>
                      <button onClick={() => handleInstallSkill(skill.id)} className="px-3 py-1 bg-lcs-primary/20 text-lcs-primary rounded text-xs hover:bg-lcs-primary/30">
                        安装
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-lcs-text">项目管理</h3>
                  <button onClick={() => {
                    const name = prompt('请输入项目名称:');
                    if (name) {
                      soulCoreService.addProject({
                        name,
                        path: `/projects/${name.toLowerCase().replace(/\s+/g, '-')}`,
                      });
                      setProjects(soulCoreService.getProjects());
                    }
                  }} className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-lcs-primary to-lcs-secondary rounded-lg text-white text-sm">
                    <Plus className="w-3 h-3" /> 新建项目
                  </button>
                </div>

                <div className="p-4 bg-lcs-surface/50 rounded-lg border border-lcs-border">
                  <div className="text-sm text-lcs-muted mb-2">当前项目路径</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-lcs-bg px-3 py-2 rounded text-lcs-text text-sm">
                      {projects.find(p => p.id === activeProjectId)?.path || '未选择项目'}
                    </code>
                    <span className="px-2 py-1 bg-lcs-primary/20 text-lcs-primary rounded text-xs">沙箱模式</span>
                  </div>
                </div>

                {projects.length > 0 ? (
                  <div className="space-y-2">
                    {projects.map(project => (
                      <div key={project.id} 
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          project.id === activeProjectId 
                            ? 'bg-lcs-primary/20 border-lcs-primary' 
                            : 'bg-lcs-surface border-lcs-border hover:border-lcs-primary/50'
                        }`}>
                        <div className="cursor-pointer flex-1" onClick={() => {
                          soulCoreService.setActiveProject(project.id);
                          setActiveProjectId(project.id);
                        }}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-lcs-text">{project.name}</span>
                            {project.id === activeProjectId && (
                              <span className="px-1.5 py-0.5 bg-lcs-primary text-white rounded text-xs">当前</span>
                            )}
                          </div>
                          <div className="text-xs text-lcs-muted">{project.path}</div>
                        </div>
                        <button onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`确定删除项目 "${project.name}"?`)) {
                            soulCoreService.deleteProject(project.id);
                            setProjects(soulCoreService.getProjects());
                            if (project.id === activeProjectId) {
                              setActiveProjectId(null);
                            }
                          }
                        }} className="p-1 text-lcs-muted hover:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-lcs-muted">
                    <FolderKanban className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>暂无项目配置</p>
                    <p className="text-xs mt-1">创建项目以管理独立的规则和配置</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'permissions' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-lcs-text">工具权限配置</h3>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      permissionService.setAllPermissions('allow');
                      setPermissions(permissionService.getAllPermissions());
                    }} className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30">
                      全部允许
                    </button>
                    <button onClick={() => {
                      permissionService.setAllPermissions('ask');
                      setPermissions(permissionService.getAllPermissions());
                    }} className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded text-xs hover:bg-yellow-500/30">
                      全部询问
                    </button>
                    <button onClick={() => {
                      permissionService.resetPermissions();
                      setPermissions(permissionService.getAllPermissions());
                    }} className="flex items-center gap-1 px-3 py-1.5 bg-lcs-surface border border-lcs-border rounded text-xs text-lcs-text hover:bg-lcs-primary/20">
                      <RotateCcw className="w-3 h-3" /> 重置
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-200">
                      <strong>权限说明：</strong>
                      <ul className="mt-1 space-y-1 text-xs">
                        <li><span className="text-green-400">允许</span> - 工具自动执行，无需确认</li>
                        <li><span className="text-yellow-400">询问</span> - 执行前需要用户确认</li>
                        <li><span className="text-red-400">禁止</span> - 禁止使用该工具</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {tools.map(tool => (
                    <div key={tool.id} className="flex items-center justify-between p-3 bg-lcs-surface rounded-lg border border-lcs-border">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{tool.icon}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-lcs-text">{tool.name}</span>
                            {tool.dangerous && (
                              <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">危险</span>
                            )}
                          </div>
                          <div className="text-xs text-lcs-muted">{tool.description}</div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {(['allow', 'ask', 'deny'] as PermissionMode[]).map(mode => (
                          <button key={mode}
                            onClick={() => {
                              permissionService.setPermission(tool.id, mode);
                              setPermissions(permissionService.getAllPermissions());
                            }}
                            className={`px-3 py-1 rounded text-xs transition-colors ${
                              permissions[tool.id] === mode
                                ? mode === 'allow' ? 'bg-green-500 text-white'
                                  : mode === 'ask' ? 'bg-yellow-500 text-black'
                                  : 'bg-red-500 text-white'
                                : 'bg-lcs-bg text-lcs-muted hover:text-lcs-text'
                            }`}>
                            {mode === 'allow' ? '允许' : mode === 'ask' ? '询问' : '禁止'}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'tokens' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-lcs-text">Token 使用统计</h3>
                  <div className="flex items-center gap-2">
                    <select 
                      value={tokenDays} 
                      onChange={(e) => {
                        const days = parseInt(e.target.value);
                        setTokenDays(days);
                        setTokenSummary(tokenTrackerService.getSummary(days));
                      }}
                      className="bg-lcs-surface border border-lcs-border rounded-lg px-3 py-1.5 text-sm text-lcs-text"
                    >
                      <option value={1}>今日</option>
                      <option value={7}>近7天</option>
                      <option value={30}>近30天</option>
                      <option value={0}>全部</option>
                    </select>
                    <button 
                      onClick={() => {
                        if (confirm('确定要清除所有 Token 使用记录吗？')) {
                          tokenTrackerService.clearHistory();
                          setTokenSummary(tokenTrackerService.getSummary(tokenDays));
                        }
                      }}
                      className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30"
                    >
                      清除记录
                    </button>
                  </div>
                </div>

                {tokenSummary && (
                  <>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="p-4 bg-lcs-surface rounded-lg border border-lcs-border">
                        <div className="text-xs text-lcs-muted mb-1">输入 Token</div>
                        <div className="text-2xl font-bold text-lcs-primary">
                          {tokenSummary.totalInputTokens.toLocaleString()}
                        </div>
                      </div>
                      <div className="p-4 bg-lcs-surface rounded-lg border border-lcs-border">
                        <div className="text-xs text-lcs-muted mb-1">输出 Token</div>
                        <div className="text-2xl font-bold text-lcs-secondary">
                          {tokenSummary.totalOutputTokens.toLocaleString()}
                        </div>
                      </div>
                      <div className="p-4 bg-lcs-surface rounded-lg border border-lcs-border">
                        <div className="text-xs text-lcs-muted mb-1">总计 Token</div>
                        <div className="text-2xl font-bold text-lcs-text">
                          {tokenSummary.totalTokens.toLocaleString()}
                        </div>
                      </div>
                      <div className="p-4 bg-lcs-surface rounded-lg border border-lcs-border">
                        <div className="text-xs text-lcs-muted mb-1">调用次数</div>
                        <div className="text-2xl font-bold text-lcs-text">
                          {tokenSummary.totalCalls}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-lcs-surface rounded-lg border border-lcs-border">
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingUp className="w-4 h-4 text-lcs-primary" />
                          <h4 className="font-medium text-lcs-text">按模型统计</h4>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(tokenSummary.byModel).map(([model, data]) => (
                            <div key={model} className="flex items-center justify-between text-sm">
                              <span className="text-lcs-muted">{model}</span>
                              <span className="text-lcs-text">
                                {data.input + data.output} ({data.calls}次)
                              </span>
                            </div>
                          ))}
                          {Object.keys(tokenSummary.byModel).length === 0 && (
                            <div className="text-sm text-lcs-muted text-center py-2">暂无数据</div>
                          )}
                        </div>
                      </div>

                      <div className="p-4 bg-lcs-surface rounded-lg border border-lcs-border">
                        <div className="flex items-center gap-2 mb-3">
                          <Calendar className="w-4 h-4 text-lcs-secondary" />
                          <h4 className="font-medium text-lcs-text">每日使用趋势</h4>
                        </div>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {tokenSummary.dailyUsage.slice(-7).reverse().map(day => (
                            <div key={day.date} className="flex items-center justify-between text-sm">
                              <span className="text-lcs-muted">{day.date}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-lcs-primary">{day.input}</span>
                                <span className="text-lcs-muted">/</span>
                                <span className="text-lcs-secondary">{day.output}</span>
                              </div>
                            </div>
                          ))}
                          {tokenSummary.dailyUsage.length === 0 && (
                            <div className="text-sm text-lcs-muted text-center py-2">暂无数据</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <div className="text-sm text-blue-200">
                        💡 <strong>提示：</strong>Token 统计基于本地估算，实际计费以 API 提供商账单为准。
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
