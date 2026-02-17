import type {
  ToolCall,
  ToolResult,
  ExecutionStep,
  ExecutorConfig,
  WorkflowTemplate,
} from './types';
import {
  DEFAULT_EXECUTOR_CONFIG,
  WORKFLOW_TEMPLATES,
} from './types';
import { toolExecutor } from './toolExecutor';

export interface ExecutionCallback {
  onStep?: (step: ExecutionStep) => void;
  onToolCall?: (call: ToolCall) => void;
  onToolResult?: (result: ToolResult) => void;
  onComplete?: (summary: string) => void;
  onError?: (error: string) => void;
  onAskUser?: (question: string, options?: string[]) => Promise<string>;
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
- list_directory: 列出目录内容
- create_directory: 创建目录
- execute_command: 执行Shell命令
- search_code: 在代码库中搜索
- web_search: 搜索互联网
- web_fetch: 获取网页内容
- git_operation: Git操作
- npm_operation: npm/yarn/pnpm操作
- ask_user: 向用户提问
- complete: 标记任务完成

## 执行原则
1. **自主执行**: 收到任务后，立即分析并开始执行，不要等待用户确认
2. **工具优先**: 优先使用工具完成任务，而不是只输出文本
3. **迭代优化**: 如果第一次尝试失败，分析原因并调整策略重试
4. **清晰反馈**: 每一步都要说明正在做什么
5. **完成标记**: 任务完成后必须调用 complete 工具

## 工作流程
1. 分析用户需求，理解目标
2. 制定执行计划（内部思考，不输出）
3. 逐步执行工具调用
4. 验证结果
5. 调用 complete 总结

## 注意事项
- 修改文件前先读取确认当前内容
- 删除操作需要谨慎
- 遇到错误要分析原因并尝试修复
- 如果需要用户输入，使用 ask_user 工具

记住：你的目标是自动完成任务，减少用户干预。`;

class AutoExecutor {
  private config: ExecutorConfig;
  private callbacks: ExecutionCallback = {};
  private steps: ExecutionStep[] = [];
  private messages: Message[] = [];
  private iteration: number = 0;
  private llmCall: ((messages: Message[]) => Promise<LLMResponse>) | null = null;
  private isRunning: boolean = false;
  private shouldStop: boolean = false;

  constructor(config: Partial<ExecutorConfig> = {}) {
    this.config = { ...DEFAULT_EXECUTOR_CONFIG, ...config };
  }

  setCallbacks(callbacks: ExecutionCallback) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  setLLMCall(llmCall: (messages: Message[]) => Promise<LLMResponse>) {
    this.llmCall = llmCall;
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

  private detectTrigger(userMessage: string): WorkflowTemplate | null {
    const lowerMessage = userMessage.toLowerCase();
    
    for (const template of WORKFLOW_TEMPLATES) {
      for (const trigger of template.trigger) {
        if (lowerMessage.includes(trigger.toLowerCase())) {
          return template;
        }
      }
    }
    
    return null;
  }

  private buildToolPrompt(): string {
    const tools = toolExecutor.getTools();
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

    this.messages.push({
      role: 'system',
      content: SYSTEM_PROMPT + '\n\n' + this.buildToolPrompt(),
    });

    const matchedWorkflow = this.detectTrigger(userMessage);
    let enhancedMessage = userMessage;
    
    if (matchedWorkflow) {
      enhancedMessage = `[检测到工作流: ${matchedWorkflow.name}]\n\n${userMessage}\n\n建议步骤:\n${matchedWorkflow.steps.map((s, i) => `${i + 1}. ${s.action}`).join('\n')}`;
    }

    this.messages.push({
      role: 'user',
      content: enhancedMessage,
    });

    this.addStep({
      type: 'message',
      content: `🎯 开始执行: ${userMessage}`,
    });

    let finalResult = '';

    try {
      while (this.iteration < this.config.maxIterations && !this.shouldStop) {
        this.iteration++;
        
        this.addStep({
          type: 'think',
          content: `💭 思考中... (迭代 ${this.iteration}/${this.config.maxIterations})`,
        });

        if (!this.llmCall) {
          throw new Error('LLM调用未配置');
        }

        const response = await this.llmCall(this.messages);

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

            if (toolCall.name === 'ask_user' && this.callbacks.onAskUser) {
              const question = toolCall.arguments.question as string;
              const options = toolCall.arguments.options as string[] | undefined;
              
              const userResponse = await this.callbacks.onAskUser(question, options);
              
              const result: ToolResult = {
                toolCallId: toolCall.id,
                name: toolCall.name,
                success: true,
                output: userResponse,
              };
              
              this.messages.push({
                role: 'tool',
                toolCallId: toolCall.id,
                name: toolCall.name,
                content: userResponse,
              });
              
              this.callbacks.onToolResult?.(result);
              this.addStep({
                type: 'tool_result',
                content: `👤 用户回答: ${userResponse}`,
                toolResult: result,
              });
            } else if (toolCall.name === 'complete') {
              const summary = toolCall.arguments.summary as string;
              const filesChanged = toolCall.arguments.files_changed as string[] | undefined;
              
              const result: ToolResult = {
                toolCallId: toolCall.id,
                name: toolCall.name,
                success: true,
                output: `✅ 任务完成`,
              };
              
              this.callbacks.onToolResult?.(result);
              this.callbacks.onComplete?.(summary);
              
              this.addStep({
                type: 'tool_result',
                content: `✅ 任务完成!\n${summary}${filesChanged ? `\n修改文件: ${filesChanged.join(', ')}` : ''}`,
                toolResult: result,
              });
              
              finalResult = summary;
              this.shouldStop = true;
              break;
            } else {
              const result = await toolExecutor.execute(toolCall);
              
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

      if (this.iteration >= this.config.maxIterations) {
        this.addStep({
          type: 'message',
          content: `⚠️ 达到最大迭代次数 (${this.config.maxIterations})，任务可能未完全完成`,
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

  getConfig(): ExecutorConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<ExecutorConfig>) {
    this.config = { ...this.config, ...config };
  }
}

export const autoExecutor = new AutoExecutor();
export { AutoExecutor };
