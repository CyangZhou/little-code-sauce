import { toolExecutionService } from './toolExecutionService';
import type { ToolCall, ToolResult } from './toolExecutionService';
import { llmService } from './llm';
import { realFileService } from './realFileService';

export interface ExecutionStep {
  id: string;
  type: 'think' | 'tool_call' | 'tool_result' | 'message';
  content: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  timestamp: number;
}

export interface ExecutionCallbacks {
  onStep?: (step: ExecutionStep) => void;
  onToolCall?: (call: ToolCall) => void;
  onToolResult?: (result: ToolResult) => void;
  onComplete?: (summary: string) => void;
  onError?: (error: string) => void;
  onAskUser?: (question: string) => Promise<string>;
  onConfirm?: (message: string, details?: string) => Promise<boolean>;
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
}

interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: string;
}

const SYSTEM_PROMPT = `你是小码酱的执行引擎，一个强大的自动化代码助手。

## 核心能力
你可以使用以下工具来完成任务：
- read_file: 读取文件内容
- write_file: 创建或覆盖写入文件
- edit_file: 编辑文件，替换指定内容
- delete_file: 删除文件（需要确认）
- list_files: 列出工作区文件
- search_code: 在代码中搜索
- create_directory: 创建目录
- web_search: 搜索互联网
- web_fetch: 获取网页内容
- run_code: 在沙箱中运行JavaScript代码
- ask_user: 向用户提问
- complete: 标记任务完成

## 执行原则
1. **自主执行**: 收到任务后，立即分析并开始执行
2. **工具优先**: 优先使用工具完成任务，而不是只输出文本
3. **迭代优化**: 如果第一次尝试失败，分析原因并调整策略重试
4. **清晰反馈**: 每一步都要说明正在做什么
5. **完成标记**: 任务完成后必须调用 complete 工具

## 工作流程
1. 分析用户需求，理解目标
2. 制定执行计划（内部思考）
3. 逐步执行工具调用
4. 验证结果
5. 调用 complete 总结

## 注意事项
- 修改文件前先读取确认当前内容
- 删除操作需要谨慎
- 遇到错误要分析原因并尝试修复
- 如果需要用户输入，使用 ask_user 工具

记住：你的目标是自动完成任务，减少用户干预。`;

class ExecutionEngine {
  private callbacks: ExecutionCallbacks = {};
  private steps: ExecutionStep[] = [];
  private messages: Message[] = [];
  private iteration: number = 0;
  private isRunning: boolean = false;
  private shouldStop: boolean = false;
  private maxIterations: number = 20;

  constructor() {
    toolExecutionService.setConfirmationCallback(async (message, details) => {
      if (this.callbacks.onConfirm) {
        return this.callbacks.onConfirm(message, details);
      }
      return true;
    });

    toolExecutionService.setUserInputCallback(async (question) => {
      if (this.callbacks.onAskUser) {
        return this.callbacks.onAskUser(question);
      }
      return '';
    });
  }

  setCallbacks(callbacks: ExecutionCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  private addStep(step: Omit<ExecutionStep, 'id' | 'timestamp'>) {
    const fullStep: ExecutionStep = {
      ...step,
      id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };
    this.steps.push(fullStep);
    this.callbacks.onStep?.(fullStep);
    return fullStep;
  }

  private buildToolPrompt(): string {
    const tools = toolExecutionService.getTools();
    const toolDescriptions = tools.map(t => {
      const params = Object.entries(t.parameters.properties)
        .map(([name, prop]) => `    - ${name}: ${prop.description}`)
        .join('\n');
      return `- ${t.name}: ${t.description}\n  参数:\n${params}`;
    }).join('\n\n');
    
    return `可用工具:\n\n${toolDescriptions}`;
  }

  async execute(userMessage: string): Promise<string> {
    if (this.isRunning) {
      return '⚠️ 已有任务正在执行中';
    }

    this.isRunning = true;
    this.shouldStop = false;
    this.steps = [];
    this.messages = [];
    this.iteration = 0;
    toolExecutionService.resetFilesChanged();

    this.messages.push({
      role: 'system',
      content: SYSTEM_PROMPT + '\n\n' + this.buildToolPrompt(),
    });

    let workspaceInfo = '';
    if (realFileService.hasWorkspace()) {
      const workspace = realFileService.getWorkspace();
      const files = realFileService.listFiles();
      workspaceInfo = `\n\n当前工作区: ${workspace?.name || '未命名'}\n文件数量: ${files.length}\n文件列表:\n${files.slice(0, 20).map(f => `- ${f.path}`).join('\n')}${files.length > 20 ? `\n... 还有 ${files.length - 20} 个文件` : ''}`;
    } else {
      workspaceInfo = '\n\n当前没有打开的工作区。如果需要操作文件，请先创建或打开一个项目。';
    }

    this.messages.push({
      role: 'user',
      content: userMessage + workspaceInfo,
    });

    this.addStep({
      type: 'message',
      content: `🎯 开始执行: ${userMessage}`,
    });

    let finalResult = '';

    try {
      while (this.iteration < this.maxIterations && !this.shouldStop) {
        this.iteration++;
        
        this.addStep({
          type: 'think',
          content: `💭 思考中... (迭代 ${this.iteration}/${this.maxIterations})`,
        });

        const response = await this.callLLM();

        if (response.content) {
          this.addStep({
            type: 'message',
            content: response.content,
          });
        }

        if (response.toolCalls && response.toolCalls.length > 0) {
          this.messages.push({
            role: 'assistant',
            content: response.content || '',
            toolCalls: response.toolCalls,
          });

          for (const toolCall of response.toolCalls) {
            this.callbacks.onToolCall?.(toolCall);
            
            this.addStep({
              type: 'tool_call',
              content: `🔧 调用工具: ${toolCall.name}`,
              toolCall,
            });

            if (toolCall.name === 'complete') {
              const summary = toolCall.arguments.summary as string;
              
              const result: ToolResult = {
                toolCallId: toolCall.id,
                name: toolCall.name,
                success: true,
                output: '✅ 任务完成',
              };
              
              this.callbacks.onToolResult?.(result);
              this.addStep({
                type: 'tool_result',
                content: `✅ 任务完成!\n${summary}`,
                toolResult: result,
              });
              
              this.callbacks.onComplete?.(summary);
              finalResult = summary;
              this.shouldStop = true;
              break;
            }

            const result = await toolExecutionService.execute(toolCall);
            
            this.messages.push({
              role: 'tool',
              toolCallId: toolCall.id,
              name: toolCall.name,
              content: result.success 
                ? result.output || '成功'
                : `错误: ${result.error}`,
            });
            
            this.callbacks.onToolResult?.(result);
            this.addStep({
              type: 'tool_result',
              content: result.success 
                ? `✓ ${result.output || '成功'}`
                : `✗ ${result.error}`,
              toolResult: result,
            });
          }
        } else {
          this.messages.push({
            role: 'assistant',
            content: response.content || '',
          });
          
          if (response.finishReason === 'stop' || !response.toolCalls) {
            finalResult = response.content || '任务完成';
            break;
          }
        }
      }

      if (this.iteration >= this.maxIterations) {
        this.addStep({
          type: 'message',
          content: `⚠️ 达到最大迭代次数 (${this.maxIterations})，任务可能未完全完成`,
        });
        finalResult = '达到最大迭代次数，任务可能未完全完成';
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.callbacks.onError?.(errorMsg);
      this.addStep({
        type: 'message',
        content: `❌ 执行错误: ${errorMsg}`,
      });
      finalResult = `执行错误: ${errorMsg}`;
    } finally {
      this.isRunning = false;
    }

    return finalResult;
  }

  private async callLLM(): Promise<LLMResponse> {
    try {
      const response = await llmService.chatForExecutor(
        this.messages.map(m => ({
          role: m.role,
          content: m.content,
          toolCalls: m.toolCalls,
          toolCallId: m.toolCallId,
          name: m.name,
        }))
      );

      return response;
    } catch (error) {
      return {
        content: `API调用失败: ${error instanceof Error ? error.message : String(error)}`,
        finishReason: 'stop',
      };
    }
  }

  stop() {
    this.shouldStop = true;
  }

  getSteps(): ExecutionStep[] {
    return [...this.steps];
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  isExecuting(): boolean {
    return this.isRunning;
  }
}

export const executionEngine = new ExecutionEngine();
export { ExecutionEngine };
