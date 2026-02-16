export interface CompressionResult {
  originalLength: number;
  compressedLength: number;
  compressionRatio: number;
  summary: string;
  keyPoints: string[];
}

export interface MessageSummary {
  role: 'user' | 'assistant';
  summary: string;
  keyActions: string[];
  tokens: number;
}

export interface ContextWindow {
  maxTokens: number;
  usedTokens: number;
  availableTokens: number;
  messages: Array<{
    id: string;
    tokens: number;
    importance: number;
  }>;
}

const TOKEN_ESTIMATE_RATIO = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / TOKEN_ESTIMATE_RATIO);
}

export function estimateMessagesTokens(messages: Array<{ content: string }>): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}

export class ContextCompressor {
  private maxContextTokens: number = 128000;
  private compressionThreshold: number = 0.8;
  private preserveRecentMessages: number = 5;

  setMaxTokens(max: number) {
    this.maxContextTokens = max;
  }

  setCompressionThreshold(threshold: number) {
    this.compressionThreshold = threshold;
  }

  getContextWindow(messages: Array<{ id: string; content: string }>): ContextWindow {
    const messageTokens = messages.map((m) => ({
      id: m.id,
      tokens: estimateTokens(m.content),
      importance: 1,
    }));

    const usedTokens = messageTokens.reduce((sum, m) => sum + m.tokens, 0);

    return {
      maxTokens: this.maxContextTokens,
      usedTokens,
      availableTokens: this.maxContextTokens - usedTokens,
      messages: messageTokens,
    };
  }

  needsCompression(messages: Array<{ content: string }>): boolean {
    const tokens = estimateMessagesTokens(messages);
    return tokens >= this.maxContextTokens * this.compressionThreshold;
  }

  compressMessages(
    messages: Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
    }>
  ): {
    compressed: Array<{ id: string; role: 'user' | 'assistant'; content: string }>;
    summary: string;
  } {
    if (messages.length <= this.preserveRecentMessages) {
      return { compressed: messages, summary: '' };
    }

    const toCompress = messages.slice(0, -this.preserveRecentMessages);
    const toPreserve = messages.slice(-this.preserveRecentMessages);

    const summary = this.generateSummary(toCompress);
    const summaryMessage = {
      id: `summary-${Date.now()}`,
      role: 'assistant' as const,
      content: `[上下文摘要]\n${summary}`,
    };

    return {
      compressed: [summaryMessage, ...toPreserve],
      summary,
    };
  }

  private generateSummary(messages: Array<{ role: 'user' | 'assistant'; content: string }>): string {
    const userMessages = messages.filter((m) => m.role === 'user');
    const assistantMessages = messages.filter((m) => m.role === 'assistant');

    const topics = this.extractTopics(userMessages);
    const actions = this.extractActions(assistantMessages);

    const summaryParts: string[] = [];

    if (topics.length > 0) {
      summaryParts.push(`讨论主题: ${topics.slice(0, 5).join(', ')}`);
    }

    if (actions.length > 0) {
      summaryParts.push(`主要操作:\n${actions.slice(0, 10).map((a) => `- ${a}`).join('\n')}`);
    }

    summaryParts.push(`压缩了 ${messages.length} 条消息`);

    return summaryParts.join('\n\n');
  }

  private extractTopics(messages: Array<{ content: string }>): string[] {
    const topics: Set<string> = new Set();
    
    const keywords = [
      '功能', '实现', '修复', '优化', '重构', '添加', '删除',
      '组件', '服务', '接口', 'API', '数据库', '配置',
      '错误', '问题', '需求', '设计', '测试',
      'function', 'class', 'component', 'service', 'api',
    ];

    messages.forEach((m) => {
      const words = m.content.toLowerCase().split(/\s+/);
      words.forEach((word) => {
        if (keywords.some((k) => word.includes(k.toLowerCase()))) {
          topics.add(word);
        }
      });
    });

    return Array.from(topics).slice(0, 10);
  }

  private extractActions(messages: Array<{ content: string }>): string[] {
    const actions: string[] = [];
    
    const actionPatterns = [
      /创建[了]?(\S+)/g,
      /添加[了]?(\S+)/g,
      /修改[了]?(\S+)/g,
      /删除[了]?(\S+)/g,
      /修复[了]?(\S+)/g,
      /实现[了]?(\S+)/g,
      /优化[了]?(\S+)/g,
      /Created?\s+(\S+)/gi,
      /Added?\s+(\S+)/gi,
      /Modified?\s+(\S+)/gi,
      /Deleted?\s+(\S+)/gi,
      /Fixed?\s+(\S+)/gi,
    ];

    messages.forEach((m) => {
      actionPatterns.forEach((pattern) => {
        const matches = m.content.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            actions.push(match[0]);
          }
        }
      });
    });

    return [...new Set(actions)];
  }

  smartTruncate(
    content: string,
    maxTokens: number,
    preserveStart: number = 100,
    preserveEnd: number = 100
  ): string {
    const tokens = estimateTokens(content);
    if (tokens <= maxTokens) return content;

    const startChars = preserveStart * TOKEN_ESTIMATE_RATIO;
    const endChars = preserveEnd * TOKEN_ESTIMATE_RATIO;
    const maxChars = maxTokens * TOKEN_ESTIMATE_RATIO;

    if (content.length <= maxChars) return content;

    const start = content.slice(0, startChars);
    const end = content.slice(-endChars);
    const truncated = maxChars - startChars - endChars;

    const middle = truncated > 50
      ? `\n\n... [已省略 ${Math.floor(truncated / TOKEN_ESTIMATE_RATIO)} tokens] ...\n\n`
      : '\n\n... ...\n\n';

    return start + middle + end;
  }

  prioritizeMessages(
    messages: Array<{
      id: string;
      content: string;
      role: 'user' | 'assistant';
    }>,
    maxTokens: number
  ): Array<{ id: string; content: string; role: 'user' | 'assistant' }> {
    const scored = messages.map((m, index) => ({
      ...m,
      tokens: estimateTokens(m.content),
      score: this.calculateImportance(m, index, messages.length),
    }));

    scored.sort((a, b) => b.score - a.score);

    const selected: typeof scored = [];
    let totalTokens = 0;

    for (const msg of scored) {
      if (totalTokens + msg.tokens <= maxTokens) {
        selected.push(msg);
        totalTokens += msg.tokens;
      }
    }

    const originalOrder = selected.sort(
      (a, b) => messages.findIndex((m) => m.id === a.id) - messages.findIndex((m) => m.id === b.id)
    );

    return originalOrder.map(({ id, content, role }) => ({ id, content, role }));
  }

  private calculateImportance(
    message: { content: string; role: 'user' | 'assistant' },
    index: number,
    total: number
  ): number {
    let score = 0;

    if (message.role === 'user') {
      score += 2;
    }

    const recency = (index + 1) / total;
    score += recency * 3;

    const codeBlocks = (message.content.match(/```/g) || []).length;
    score += codeBlocks * 0.5;

    const length = message.content.length;
    if (length > 100 && length < 2000) {
      score += 1;
    }

    const keywords = ['重要', '关键', '核心', '必须', 'important', 'key', 'critical'];
    keywords.forEach((k) => {
      if (message.content.toLowerCase().includes(k)) {
        score += 1;
      }
    });

    return score;
  }
}

export const contextCompressor = new ContextCompressor();
