# 交付文档 - 功能真实化与去 Mock (Real Implementation)

## 1. 变更摘要

### 🚀 核心功能真实化
- **LLM 服务 (`llm.ts`)**: 
  - 彻底移除了所有 `mockResponse` 和模拟工具调用逻辑。
  - 现在强制要求配置 API Key。如果未配置，会直接返回错误提示 "⚠️ 请在设置中配置 API Key"，而不是假装工作。
  - 支持 DeepSeek, OpenAI, Anthropic 和 Local (Ollama) 的真实调用。

- **文件系统 (`toolExecution.ts`)**:
  - 移除了基于内存 Map 的 `virtualFS`。
  - 全面接入 `realFileService`，利用浏览器 **File System Access API** 直接读写用户本地文件。
  - Agent 现在可以真正修改你打开的项目文件，而不仅仅是修改内存中的副本。

- **MCP 服务 (`mcp.ts`)**:
  - 实现了 `filesystem` 和 `fetch` MCP 服务器的浏览器端映射。
  - `read_file`, `write_file`, `list_directory` 现在直接映射到 `realFileService`。
  - `fetch_url` 现在直接映射到浏览器的 `fetch` API。
  - 对于不支持的命令（如 `npx` 启动的 server），现在会明确返回错误，而不是假装连接成功。

### 💻 终端与命令
- **终端面板 (`TerminalPanel.tsx`)**:
  - 更新了 `help` 命令，明确说明当前环境限制（文件操作有效，系统命令需本地环境）。
  - `node` 命令继续保留（使用 `eval`），但已在帮助中标记为 "浏览器环境"。

## 2. 验证结果
- ✅ **构建检查**: `npm run build` 通过 (Exit Code 0)。
- ✅ **逻辑验证**:
  - 无 API Key -> 提示错误 ✅
  - 文件读写 -> 调用 `realFileService` ✅
  - MCP 调用 -> 映射到真实 API ✅

## 3. 使用说明
1. **配置 API**: 请点击左下角设置图标，选择 "LLM 设置"，输入您的 DeepSeek 或 OpenAI Key。
2. **打开工作区**: 点击左上角文件夹图标，选择 "打开本地文件夹"，授予浏览器读写权限。
3. **开始使用**: 输入 "开始 帮我写一个 React 组件"，小码酱将真正调用 LLM 并尝试写入文件。

## 4. 已知限制
- **系统命令**: `npm`, `git`, `python` 等命令无法在纯浏览器环境中执行。需等待后续版本接入 `neuro-bridge` 本地代理。
- **安全性**: `node` 命令在浏览器沙箱中运行，无法访问系统底层 API。
