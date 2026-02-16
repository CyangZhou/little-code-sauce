export interface SkillManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  tags: string[];
  capabilities: string[];
  dependencies: string[];
  config?: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'select';
    label: string;
    description?: string;
    default?: unknown;
    options?: { label: string; value: unknown }[];
  }>;
}

export interface SkillMarketItem {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  downloads: number;
  stars: number;
  tags: string[];
  source: 'github' | 'npm' | 'local';
  url: string;
  installed: boolean;
}

const SKILL_MARKET_PLACEHOLDER: SkillMarketItem[] = [
  {
    id: 'skill-code-review',
    name: '代码审查',
    version: '1.0.0',
    description: '自动审查代码质量、安全性和最佳实践',
    author: 'LittleCodeSauce',
    downloads: 1234,
    stars: 89,
    tags: ['code', 'review', 'quality'],
    source: 'local',
    url: '',
    installed: false,
  },
  {
    id: 'skill-git-commit',
    name: 'Git提交助手',
    version: '1.0.0',
    description: '自动生成规范的Git提交信息',
    author: 'LittleCodeSauce',
    downloads: 2345,
    stars: 156,
    tags: ['git', 'commit', 'automation'],
    source: 'local',
    url: '',
    installed: false,
  },
  {
    id: 'skill-test-gen',
    name: '测试生成器',
    version: '1.0.0',
    description: '自动生成单元测试和集成测试',
    author: 'LittleCodeSauce',
    downloads: 987,
    stars: 67,
    tags: ['test', 'automation', 'quality'],
    source: 'local',
    url: '',
    installed: false,
  },
  {
    id: 'skill-doc-gen',
    name: '文档生成器',
    version: '1.0.0',
    description: '自动生成API文档和README',
    author: 'LittleCodeSauce',
    downloads: 876,
    stars: 45,
    tags: ['doc', 'automation', 'api'],
    source: 'local',
    url: '',
    installed: false,
  },
  {
    id: 'skill-refactor',
    name: '代码重构',
    version: '1.0.0',
    description: '智能重构代码，提升可读性和性能',
    author: 'LittleCodeSauce',
    downloads: 654,
    stars: 34,
    tags: ['refactor', 'code', 'optimization'],
    source: 'local',
    url: '',
    installed: false,
  },
];

class SkillService {
  private installedSkills: Map<string, SkillManifest> = new Map();

  constructor() {
    this.loadInstalled();
  }

  private loadInstalled() {
    try {
      const saved = localStorage.getItem('lcs-installed-skills');
      if (saved) {
        const skills = JSON.parse(saved);
        skills.forEach((s: SkillManifest) => this.installedSkills.set(s.id, s));
      }
    } catch (e) {
      console.error('Failed to load installed skills:', e);
    }
  }

  private saveInstalled() {
    localStorage.setItem(
      'lcs-installed-skills',
      JSON.stringify(Array.from(this.installedSkills.values()))
    );
  }

  getMarketSkills(): SkillMarketItem[] {
    return SKILL_MARKET_PLACEHOLDER.map(item => ({
      ...item,
      installed: this.installedSkills.has(item.id),
    }));
  }

  getInstalledSkills(): SkillManifest[] {
    return Array.from(this.installedSkills.values());
  }

  installSkill(skillId: string): boolean {
    const marketItem = SKILL_MARKET_PLACEHOLDER.find(s => s.id === skillId);
    if (!marketItem) return false;

    const manifest: SkillManifest = {
      id: skillId,
      name: marketItem.name,
      version: marketItem.version,
      description: marketItem.description,
      author: marketItem.author,
      tags: marketItem.tags,
      capabilities: [],
      dependencies: [],
    };

    this.installedSkills.set(skillId, manifest);
    this.saveInstalled();
    return true;
  }

  uninstallSkill(skillId: string): boolean {
    if (!this.installedSkills.has(skillId)) return false;
    this.installedSkills.delete(skillId);
    this.saveInstalled();
    return true;
  }

  async searchSkills(query: string): Promise<SkillMarketItem[]> {
    const lowerQuery = query.toLowerCase();
    return SKILL_MARKET_PLACEHOLDER.filter(
      s => s.name.toLowerCase().includes(lowerQuery) ||
           s.description.toLowerCase().includes(lowerQuery) ||
           s.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }

  createCustomSkill(manifest: Omit<SkillManifest, 'id'>): SkillManifest {
    const skill: SkillManifest = {
      ...manifest,
      id: `custom-skill-${Date.now()}`,
    };
    this.installedSkills.set(skill.id, skill);
    this.saveInstalled();
    return skill;
  }
}

export const skillService = new SkillService();
