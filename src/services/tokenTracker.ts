export interface TokenUsageRecord {
  id: string;
  timestamp: number;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  conversationId?: string;
}

export interface TokenUsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCalls: number;
  byProvider: Record<string, { input: number; output: number; calls: number }>;
  byModel: Record<string, { input: number; output: number; calls: number }>;
  dailyUsage: { date: string; input: number; output: number }[];
}

const STORAGE_KEY = 'lcs-token-usage';
const MAX_RECORDS = 1000;

class TokenTrackerService {
  private records: TokenUsageRecord[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.records = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load token usage:', e);
      this.records = [];
    }
  }

  private saveToStorage(): void {
    try {
      if (this.records.length > MAX_RECORDS) {
        this.records = this.records.slice(-MAX_RECORDS);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
    } catch (e) {
      console.error('Failed to save token usage:', e);
    }
  }

  recordUsage(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    conversationId?: string
  ): TokenUsageRecord {
    const record: TokenUsageRecord = {
      id: `token-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      provider,
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      conversationId,
    };

    this.records.push(record);
    this.saveToStorage();
    
    return record;
  }

  getRecords(limit?: number): TokenUsageRecord[] {
    const sorted = [...this.records].sort((a, b) => b.timestamp - a.timestamp);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  getSummary(days?: number): TokenUsageSummary {
    const cutoff = days ? Date.now() - days * 24 * 60 * 60 * 1000 : 0;
    const filtered = this.records.filter(r => r.timestamp >= cutoff);

    const summary: TokenUsageSummary = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalCalls: filtered.length,
      byProvider: {},
      byModel: {},
      dailyUsage: [],
    };

    const dailyMap: Record<string, { input: number; output: number }> = {};

    filtered.forEach(record => {
      summary.totalInputTokens += record.inputTokens;
      summary.totalOutputTokens += record.outputTokens;
      summary.totalTokens += record.totalTokens;

      if (!summary.byProvider[record.provider]) {
        summary.byProvider[record.provider] = { input: 0, output: 0, calls: 0 };
      }
      summary.byProvider[record.provider].input += record.inputTokens;
      summary.byProvider[record.provider].output += record.outputTokens;
      summary.byProvider[record.provider].calls++;

      if (!summary.byModel[record.model]) {
        summary.byModel[record.model] = { input: 0, output: 0, calls: 0 };
      }
      summary.byModel[record.model].input += record.inputTokens;
      summary.byModel[record.model].output += record.outputTokens;
      summary.byModel[record.model].calls++;

      const date = new Date(record.timestamp).toISOString().split('T')[0];
      if (!dailyMap[date]) {
        dailyMap[date] = { input: 0, output: 0 };
      }
      dailyMap[date].input += record.inputTokens;
      dailyMap[date].output += record.outputTokens;
    });

    summary.dailyUsage = Object.entries(dailyMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return summary;
  }

  getTodayUsage(): { input: number; output: number; calls: number } {
    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date(today).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;

    const todayRecords = this.records.filter(
      r => r.timestamp >= todayStart && r.timestamp < todayEnd
    );

    return {
      input: todayRecords.reduce((sum, r) => sum + r.inputTokens, 0),
      output: todayRecords.reduce((sum, r) => sum + r.outputTokens, 0),
      calls: todayRecords.length,
    };
  }

  estimateTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    const numbers = (text.match(/\d+/g) || []).length;
    const other = text.length - chineseChars - (text.match(/[a-zA-Z]+/g) || []).join('').length;
    
    return Math.ceil(chineseChars * 1.5 + englishWords * 1.3 + numbers * 0.5 + other * 0.5);
  }

  estimateMessagesTokens(messages: { role: string; content: string }[]): { input: number } {
    let totalInput = 0;
    
    messages.forEach(msg => {
      totalInput += this.estimateTokens(msg.role) + 4;
      totalInput += this.estimateTokens(msg.content);
    });
    
    totalInput += 3;
    
    return { input: totalInput };
  }

  clearHistory(): void {
    this.records = [];
    this.saveToStorage();
  }

  exportData(): string {
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      records: this.records,
      summary: this.getSummary(),
    }, null, 2);
  }
}

export const tokenTrackerService = new TokenTrackerService();
