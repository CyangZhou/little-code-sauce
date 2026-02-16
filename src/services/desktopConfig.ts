export interface DesktopAppConfig {
  name: string;
  version: string;
  description: string;
  author: string;
  homepage: string;
  license: string;
  repository: string;
  build: {
    beforeBuild: string[];
    beforeDev: string[];
    devUrl: string;
    distDir: string;
  };
  tauri: TauriConfig;
  plugins: PluginConfig[];
}

export interface TauriConfig {
  bundle: {
    active: boolean;
    targets: string[];
    identifier: string;
    icon: string[];
    resources: string[];
    copyright: string;
    category: string;
    shortDescription: string;
    longDescription: string;
    windows: {
      certificateThumbprint: string;
      digestAlgorithm: string;
      timestampUrl: string;
    };
    macos: {
      frameworks: string[];
      minimumSystemVersion: string;
      license: string;
    };
    linux: {
      deb: {
        depends: string[];
      };
      appimage: {
        bundleMediaFramework: boolean;
      };
    };
  };
  security: {
    csp: string;
    dangerousDisableAssetCspModification: boolean;
  };
  windows: Array<{
    title: string;
    width: number;
    height: number;
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    resizable: boolean;
    fullscreen: boolean;
    focus: boolean;
    transparent: boolean;
    maximizable: boolean;
    minimizable: boolean;
    closable: boolean;
    decorations: boolean;
    alwaysOnTop: boolean;
    visible: boolean;
    center: boolean;
    theme: 'light' | 'dark' | 'auto';
  }>;
  systemTray: {
    iconPath: string;
    iconAsTemplate: boolean;
    menuOnLeftClick: boolean;
  };
  allowlist: {
    all: boolean;
    fs: {
      all: boolean;
      scope: string[];
    };
    shell: {
      all: boolean;
      open: boolean;
      scope: Array<{
        name: string;
        cmd: string;
        args: boolean;
      }>;
    };
    http: {
      all: boolean;
      scope: string[];
    };
    notification: {
      all: boolean;
    };
    clipboard: {
      all: boolean;
    };
    dialog: {
      all: boolean;
    };
  };
}

export interface PluginConfig {
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

const DEFAULT_DESKTOP_CONFIG: DesktopAppConfig = {
  name: '小码酱',
  version: '0.3.0',
  description: 'AI驱动的智能代码助手',
  author: 'Little Code Sauce Team',
  homepage: 'https://lcs.dev',
  license: 'MIT',
  repository: 'https://github.com/lcs/little-code-sauce',
  build: {
    beforeBuild: ['npm run build'],
    beforeDev: ['npm run dev'],
    devUrl: 'http://localhost:5173',
    distDir: '../dist',
  },
  tauri: {
    bundle: {
      active: true,
      targets: ['msi', 'nsis', 'dmg', 'deb', 'appimage'],
      identifier: 'dev.lcs.app',
      icon: [
        'icons/32x32.png',
        'icons/128x128.png',
        'icons/128x128@2x.png',
        'icons/icon.icns',
        'icons/icon.ico',
      ],
      resources: ['resources/*'],
      copyright: 'Copyright © 2024-2026 Little Code Sauce Team',
      category: 'DeveloperTool',
      shortDescription: 'AI代码助手',
      longDescription: '小码酱是一个AI驱动的智能代码助手，帮助你更高效地编写代码。',
      windows: {
        certificateThumbprint: '',
        digestAlgorithm: 'sha256',
        timestampUrl: 'http://timestamp.digicert.com',
      },
      macos: {
        frameworks: [],
        minimumSystemVersion: '10.13',
        license: '',
      },
      linux: {
        deb: {
          depends: ['libwebkit2gtk-4.0-37', 'libgtk-3-0'],
        },
        appimage: {
          bundleMediaFramework: false,
        },
      },
    },
    security: {
      csp: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
      dangerousDisableAssetCspModification: false,
    },
    windows: [
      {
        title: '小码酱',
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        resizable: true,
        fullscreen: false,
        focus: true,
        transparent: false,
        maximizable: true,
        minimizable: true,
        closable: true,
        decorations: true,
        alwaysOnTop: false,
        visible: true,
        center: true,
        theme: 'dark',
      },
    ],
    systemTray: {
      iconPath: 'icons/icon.png',
      iconAsTemplate: true,
      menuOnLeftClick: false,
    },
    allowlist: {
      all: false,
      fs: {
        all: true,
        scope: ['$HOME/.lcs/**', '$CWD/**'],
      },
      shell: {
        all: false,
        open: true,
        scope: [
          { name: 'open-terminal', cmd: 'cmd.exe', args: true },
          { name: 'open-terminal-unix', cmd: 'bash', args: true },
        ],
      },
      http: {
        all: true,
        scope: ['https://api.deepseek.com/**', 'https://api.openai.com/**'],
      },
      notification: {
        all: true,
      },
      clipboard: {
        all: true,
      },
      dialog: {
        all: true,
      },
    },
  },
  plugins: [
    {
      name: 'fs-watch',
      enabled: true,
      config: {},
    },
    {
      name: 'updater',
      enabled: true,
      config: {
        endpoints: ['https://lcs.dev/api/updates'],
        pubkey: '',
      },
    },
    {
      name: 'window-state',
      enabled: true,
      config: {},
    },
  ],
};

class DesktopConfigService {
  private config: DesktopAppConfig;

  constructor() {
    this.config = DEFAULT_DESKTOP_CONFIG;
  }

  getConfig(): DesktopAppConfig {
    return this.config;
  }

  updateConfig(updates: Partial<DesktopAppConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  generateTauriConfJson(): string {
    const tauriConf = {
      build: {
        beforeBuildCommand: this.config.build.beforeBuild.join(' && '),
        beforeDevCommand: this.config.build.beforeDev.join(' && '),
        devUrl: this.config.build.devUrl,
        distDir: this.config.build.distDir,
      },
      package: {
        productName: this.config.name,
        version: this.config.version,
      },
      tauri: {
        allowlist: this.config.tauri.allowlist,
        bundle: this.config.tauri.bundle,
        security: this.config.tauri.security,
        systemTray: this.config.tauri.systemTray,
        windows: this.config.tauri.windows,
      },
      plugins: this.config.plugins.reduce((acc, plugin) => {
        if (plugin.enabled) {
          acc[plugin.name] = plugin.config;
        }
        return acc;
      }, {} as Record<string, unknown>),
    };

    return JSON.stringify(tauriConf, null, 2);
  }

  generatePackageJson(): string {
    const pkg = {
      name: this.config.name.toLowerCase().replace(/\s+/g, '-'),
      version: this.config.version,
      description: this.config.description,
      author: this.config.author,
      homepage: this.config.homepage,
      license: this.config.license,
      repository: {
        type: 'git',
        url: this.config.repository,
      },
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
        tauri: 'tauri',
        'tauri:dev': 'tauri dev',
        'tauri:build': 'tauri build',
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
        zustand: '^4.5.0',
      },
      devDependencies: {
        '@tauri-apps/cli': '^1.5.0',
        typescript: '^5.3.0',
        vite: '^5.0.0',
      },
    };

    return JSON.stringify(pkg, null, 2);
  }

  generateCargoToml(): string {
    return `[package]
name = "${this.config.name.toLowerCase().replace(/\s+/g, '-')}"
version = "${this.config.version}"
description = "${this.config.description}"
authors = ["${this.config.author}"]
license = "${this.config.license}"
repository = "${this.config.repository}"
edition = "2021"

[build-dependencies]
tauri-build = { version = "1.5", features = [] }

[dependencies]
tauri = { version = "1.5", features = ["shell-open", "notification-all", "clipboard-all", "dialog-all", "fs-all", "http-all", "window-all"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
`;
  }

  generateMainRs(): string {
    return `// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
`;
  }

  generateBuildRs(): string {
    return `fn main() {
    tauri_build::build()
}
`;
  }

  exportAll(): Record<string, string> {
    return {
      'tauri.conf.json': this.generateTauriConfJson(),
      'package.json': this.generatePackageJson(),
      'src-tauri/Cargo.toml': this.generateCargoToml(),
      'src-tauri/src/main.rs': this.generateMainRs(),
      'src-tauri/build.rs': this.generateBuildRs(),
    };
  }

  getBuildCommands(): Record<string, string> {
    return {
      '开发模式': 'npm run tauri:dev',
      '构建生产版本': 'npm run tauri:build',
      '仅构建Windows': 'npm run tauri:build -- --target x86_64-pc-windows-msvc',
      '仅构建macOS': 'npm run tauri:build -- --target aarch64-apple-darwin',
      '仅构建Linux': 'npm run tauri:build -- --target x86_64-unknown-linux-gnu',
    };
  }

  getSupportedPlatforms(): Array<{
    name: string;
    target: string;
    ext: string;
  }> {
    return [
      { name: 'Windows x64', target: 'x86_64-pc-windows-msvc', ext: '.msi' },
      { name: 'macOS Apple Silicon', target: 'aarch64-apple-darwin', ext: '.dmg' },
      { name: 'macOS Intel', target: 'x86_64-apple-darwin', ext: '.dmg' },
      { name: 'Linux x64', target: 'x86_64-unknown-linux-gnu', ext: '.deb' },
      { name: 'Linux AppImage', target: 'x86_64-unknown-linux-gnu', ext: '.AppImage' },
    ];
  }
}

export const desktopConfigService = new DesktopConfigService();
export { DEFAULT_DESKTOP_CONFIG };
