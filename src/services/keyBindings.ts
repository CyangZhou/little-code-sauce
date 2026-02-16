import { useEffect, useCallback } from 'react';

export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
}

export interface KeyBindingsConfig {
  bindings: KeyBinding[];
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export function formatKeyBinding(binding: KeyBinding): string {
  const parts: string[] = [];
  
  if (binding.ctrl || binding.meta) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (binding.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }
  if (binding.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  
  parts.push(binding.key.toUpperCase());
  
  return parts.join(isMac ? '' : '+');
}

export function useKeyBindings(bindings: KeyBinding[]) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    for (const binding of bindings) {
      const ctrlMatch = binding.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
      const shiftMatch = binding.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = binding.alt ? event.altKey : !event.altKey;
      
      const keyMatch = event.key.toLowerCase() === binding.key.toLowerCase();
      
      if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
        event.preventDefault();
        binding.action();
        return;
      }
    }
  }, [bindings]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

export const DEFAULT_KEY_BINDINGS: Omit<KeyBinding, 'action'>[] = [
  { key: 'Enter', ctrl: true, description: '发送消息' },
  { key: 'k', ctrl: true, description: '清空对话' },
  { key: '/', ctrl: true, description: '显示命令面板' },
  { key: 'Tab', description: '切换Agent模式' },
  { key: 'b', ctrl: true, description: '切换侧边栏' },
  { key: 'j', ctrl: true, description: '切换终端' },
  { key: 'e', ctrl: true, description: '切换文件浏览器' },
  { key: 's', ctrl: true, description: '保存当前文件' },
  { key: 'z', ctrl: true, description: '撤销' },
  { key: 'z', ctrl: true, shift: true, description: '重做' },
  { key: 'y', ctrl: true, description: '重做' },
  { key: 'f', ctrl: true, description: '搜索' },
  { key: 'p', ctrl: true, description: '快速打开文件' },
  { key: 'Escape', description: '关闭面板/取消' },
];

export function getKeyBindingsHelp(): string {
  const lines = DEFAULT_KEY_BINDINGS.map(binding => {
    const key = formatKeyBinding(binding as KeyBinding);
    return `  \`${key}\` - ${binding.description}`;
  });
  
  return `⌨️ **快捷键**

${lines.join('\n')}

---
*快捷键可在设置中自定义*`;
}

export class KeyBindingsManager {
  private bindings: Map<string, KeyBinding> = new Map();
  private enabled: boolean = true;

  register(binding: KeyBinding) {
    const id = this.getBindingId(binding);
    this.bindings.set(id, binding);
  }

  unregister(binding: KeyBinding) {
    const id = this.getBindingId(binding);
    this.bindings.delete(id);
  }

  private getBindingId(binding: KeyBinding): string {
    return [
      binding.ctrl ? 'ctrl' : '',
      binding.shift ? 'shift' : '',
      binding.alt ? 'alt' : '',
      binding.key.toLowerCase(),
    ].filter(Boolean).join('-');
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  handleEvent(event: KeyboardEvent): boolean {
    if (!this.enabled) return false;

    for (const [, binding] of this.bindings) {
      const ctrlMatch = binding.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
      const shiftMatch = binding.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = binding.alt ? event.altKey : !event.altKey;
      const keyMatch = event.key.toLowerCase() === binding.key.toLowerCase();

      if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
        event.preventDefault();
        binding.action();
        return true;
      }
    }

    return false;
  }

  getBindings(): KeyBinding[] {
    return Array.from(this.bindings.values());
  }
}

export const keyBindingsManager = new KeyBindingsManager();
