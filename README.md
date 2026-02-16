# 🧠 小码酱 (Little Code Sauce)

> AI驱动的智能代码助手 - 对齐OpenCode的开源替代方案

[![GitHub stars](https://img.shields.io/github/stars/CyangZhou/little-code-sauce?style=social)](https://github.com/CyangZhou/little-code-sauce)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-61dafb)](https://reactjs.org/)

## ✨ 特性

### 核心功能
- 🚀 **15+ 斜杠命令** - `/help`, `/open`, `/terminal`, `/agent` 等
- 📁 **@ 文件引用** - 直接在对话中引用项目文件
- 🔄 **Agent模式切换** - `build` (完整开发) / `plan` (只读分析)
- 💻 **终端面板** - 内置终端模拟器
- 📂 **文件浏览器** - 项目文件树导航
- 🔀 **Diff视图** - 代码变更可视化预览

### AI能力
- 🤖 **多模型支持** - DeepSeek, OpenAI, Anthropic, Google, 本地模型
- 🧠 **上下文压缩** - 智能Token管理和压缩
- 📝 **代码分析** - 指标计算、问题检测、优化建议
- 🔌 **MCP协议** - 10+ 内置MCP服务器支持

### 开发体验
- ⌨️ **快捷键系统** - 可自定义快捷键
- 🎨 **主题系统** - 7个内置主题 (暗夜/晨曦/Monokai/Dracula等)
- 🖼️ **图片支持** - 拖拽/粘贴/上传图片
- 💾 **会话管理** - 完整CRUD操作
- 🔌 **插件系统** - 可扩展插件框架

### 集成
- 🔧 **Git集成** - 完整Git操作API
- 📋 **AGENTS.md** - 项目配置文件支持
- 🖥️ **桌面应用** - Tauri配置模板

## 📦 安装

```bash
# 克隆仓库
git clone https://github.com/CyangZhou/little-code-sauce.git

# 进入目录
cd little-code-sauce

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 🚀 快速开始

1. 打开浏览器访问 `http://localhost:5173`
2. 点击设置图标配置API密钥
3. 开始与小码酱对话！

### 斜杠命令

| 命令 | 功能 | 示例 |
|------|------|------|
| `/help` | 查看帮助 | `/help open` |
| `/open` | 打开文件 | `/open App.tsx` |
| `/terminal` | 切换终端 | `/t` |
| `/agent` | 切换模式 | `/agent plan` |
| `/model` | 切换模型 | `/model gpt-4` |
| `/undo` | 撤销更改 | `/u` |
| `/share` | 分享对话 | `/share` |
| `/init` | 初始化项目 | `/init` |

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Enter` | 发送消息 |
| `Ctrl+K` | 清空对话 |
| `Ctrl+/` | 命令面板 |
| `Tab` | 切换Agent模式 |
| `Ctrl+B` | 切换侧边栏 |
| `Ctrl+J` | 切换终端 |

## 🏗️ 项目结构

```
src/
├── components/          # React组件
│   ├── ChatPanel.tsx    # 对话面板
│   ├── CodeEditor.tsx   # 代码编辑器
│   ├── DiffView.tsx     # Diff视图
│   ├── FileExplorer.tsx # 文件浏览器
│   ├── SessionList.tsx  # 会话列表
│   └── TerminalPanel.tsx# 终端面板
├── services/            # 核心服务
│   ├── slashCommands.ts # 斜杠命令
│   ├── fileReference.ts # 文件引用
│   ├── mcp.ts           # MCP协议
│   ├── gitService.ts    # Git集成
│   ├── codeAnalysis.ts  # 代码分析
│   └── ...              # 更多服务
├── store/               # 状态管理
│   └── useAppStore.ts   # Zustand Store
└── core/                # 核心逻辑
    └── soul.ts          # 灵魂核心
```

## 🔧 配置

### API配置

1. 点击右上角设置图标
2. 选择API配置标签
3. 选择提供商并输入API密钥
4. 点击测试连接验证

### 主题配置

设置 → 外观 → 选择主题

### MCP配置

设置 → MCP配置 → 启用/禁用MCP服务器

## 📊 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **状态管理**: Zustand
- **样式**: Tailwind CSS
- **代码编辑**: Monaco Editor
- **Markdown**: React Markdown

## 🤝 贡献

欢迎贡献！请查看 [贡献指南](CONTRIBUTING.md)

## 📄 许可证

[MIT License](LICENSE)

## 🙏 致谢

- 灵感来源: [OpenCode](https://github.com/sst/opencode)
- UI参考: Claude Code, Cursor

---

**小码酱** - 让AI成为你的编程伙伴 🚀
