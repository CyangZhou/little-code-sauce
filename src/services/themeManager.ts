export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  error: string;
  success: string;
  warning: string;
}

export interface Theme {
  id: string;
  name: string;
  type: 'dark' | 'light';
  colors: ThemeColors;
  custom?: boolean;
}

export const BUILTIN_THEMES: Theme[] = [
  {
    id: 'lcs-dark',
    name: '小码酱暗夜',
    type: 'dark',
    colors: {
      primary: '#8b5cf6',
      secondary: '#06b6d4',
      accent: '#f472b6',
      background: '#0f0f1a',
      surface: '#1a1a2e',
      text: '#e2e8f0',
      muted: '#64748b',
      border: '#2d2d44',
      error: '#ef4444',
      success: '#22c55e',
      warning: '#f59e0b',
    },
  },
  {
    id: 'lcs-light',
    name: '小码酱晨曦',
    type: 'light',
    colors: {
      primary: '#7c3aed',
      secondary: '#0891b2',
      accent: '#ec4899',
      background: '#f8fafc',
      surface: '#ffffff',
      text: '#1e293b',
      muted: '#94a3b8',
      border: '#e2e8f0',
      error: '#dc2626',
      success: '#16a34a',
      warning: '#d97706',
    },
  },
  {
    id: 'monokai',
    name: 'Monokai',
    type: 'dark',
    colors: {
      primary: '#a6e22e',
      secondary: '#66d9ef',
      accent: '#f92672',
      background: '#272822',
      surface: '#3e3d32',
      text: '#f8f8f2',
      muted: '#75715e',
      border: '#49483e',
      error: '#f92672',
      success: '#a6e22e',
      warning: '#e6db74',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    type: 'dark',
    colors: {
      primary: '#bd93f9',
      secondary: '#8be9fd',
      accent: '#ff79c6',
      background: '#282a36',
      surface: '#44475a',
      text: '#f8f8f2',
      muted: '#6272a4',
      border: '#44475a',
      error: '#ff5555',
      success: '#50fa7b',
      warning: '#f1fa8c',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    type: 'dark',
    colors: {
      primary: '#88c0d0',
      secondary: '#81a1c1',
      accent: '#b48ead',
      background: '#2e3440',
      surface: '#3b4252',
      text: '#eceff4',
      muted: '#d8dee9',
      border: '#4c566a',
      error: '#bf616a',
      success: '#a3be8c',
      warning: '#ebcb8b',
    },
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    type: 'dark',
    colors: {
      primary: '#58a6ff',
      secondary: '#7ee787',
      accent: '#f778ba',
      background: '#0d1117',
      surface: '#161b22',
      text: '#c9d1d9',
      muted: '#8b949e',
      border: '#30363d',
      error: '#f85149',
      success: '#3fb950',
      warning: '#d29922',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    type: 'dark',
    colors: {
      primary: '#7aa2f7',
      secondary: '#7dcfff',
      accent: '#bb9af7',
      background: '#1a1b26',
      surface: '#24283b',
      text: '#c0caf5',
      muted: '#565f89',
      border: '#292e42',
      error: '#f7768e',
      success: '#9ece6a',
      warning: '#e0af68',
    },
  },
];

export class ThemeManager {
  private currentTheme: string = 'lcs-dark';
  private customThemes: Map<string, Theme> = new Map();
  private listeners: Set<(theme: Theme) => void> = new Set();

  constructor() {
    this.loadCustomThemes();
  }

  private loadCustomThemes() {
    try {
      const saved = localStorage.getItem('lcs-custom-themes');
      if (saved) {
        const themes = JSON.parse(saved) as Theme[];
        themes.forEach((t) => this.customThemes.set(t.id, t));
      }
      
      const current = localStorage.getItem('lcs-current-theme');
      if (current) {
        this.currentTheme = current;
      }
    } catch {
      console.warn('Failed to load custom themes');
    }
  }

  private saveCustomThemes() {
    try {
      const themes = Array.from(this.customThemes.values());
      localStorage.setItem('lcs-custom-themes', JSON.stringify(themes));
      localStorage.setItem('lcs-current-theme', this.currentTheme);
    } catch {
      console.warn('Failed to save custom themes');
    }
  }

  getCurrentTheme(): Theme {
    const builtin = BUILTIN_THEMES.find((t) => t.id === this.currentTheme);
    if (builtin) return builtin;
    
    const custom = this.customThemes.get(this.currentTheme);
    if (custom) return custom;
    
    return BUILTIN_THEMES[0];
  }

  setTheme(id: string): boolean {
    const builtin = BUILTIN_THEMES.find((t) => t.id === id);
    const custom = this.customThemes.get(id);
    
    if (builtin || custom) {
      this.currentTheme = id;
      this.saveCustomThemes();
      this.notifyListeners();
      return true;
    }
    
    return false;
  }

  getAllThemes(): Theme[] {
    return [...BUILTIN_THEMES, ...Array.from(this.customThemes.values())];
  }

  getBuiltinThemes(): Theme[] {
    return BUILTIN_THEMES;
  }

  getCustomThemes(): Theme[] {
    return Array.from(this.customThemes.values());
  }

  addCustomTheme(theme: Omit<Theme, 'id' | 'custom'>): Theme {
    const id = `custom-${Date.now()}`;
    const newTheme: Theme = {
      ...theme,
      id,
      custom: true,
    };
    
    this.customThemes.set(id, newTheme);
    this.saveCustomThemes();
    
    return newTheme;
  }

  updateCustomTheme(id: string, updates: Partial<Omit<Theme, 'id'>>): boolean {
    const theme = this.customThemes.get(id);
    if (!theme) return false;
    
    const updated = { ...theme, ...updates };
    this.customThemes.set(id, updated);
    this.saveCustomThemes();
    
    if (this.currentTheme === id) {
      this.notifyListeners();
    }
    
    return true;
  }

  deleteCustomTheme(id: string): boolean {
    if (!this.customThemes.has(id)) return false;
    
    this.customThemes.delete(id);
    this.saveCustomThemes();
    
    if (this.currentTheme === id) {
      this.currentTheme = 'lcs-dark';
      this.notifyListeners();
    }
    
    return true;
  }

  applyTheme(theme: Theme) {
    const root = document.documentElement;
    
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--lcs-${key}`, value);
    });
    
    root.setAttribute('data-theme', theme.type);
  }

  subscribe(listener: (theme: Theme) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const theme = this.getCurrentTheme();
    this.listeners.forEach((l) => l(theme));
  }

  exportTheme(id: string): string | null {
    const theme = this.customThemes.get(id) || BUILTIN_THEMES.find((t) => t.id === id);
    return theme ? JSON.stringify(theme, null, 2) : null;
  }

  importTheme(data: string): Theme | null {
    try {
      const theme = JSON.parse(data) as Theme;
      return this.addCustomTheme({
        name: theme.name,
        type: theme.type,
        colors: theme.colors,
      });
    } catch {
      return null;
    }
  }
}

export const themeManager = new ThemeManager();
