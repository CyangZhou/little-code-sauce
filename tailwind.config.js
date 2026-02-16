/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'lcs-primary': '#8b5cf6',
        'lcs-secondary': '#ec4899',
        'lcs-bg': '#0f0f23',
        'lcs-surface': '#1a1a2e',
        'lcs-border': '#2d2d44',
        'lcs-text': '#e4e4f1',
        'lcs-muted': '#6b7280',
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #8b5cf6, 0 0 10px #8b5cf6, 0 0 15px #8b5cf6' },
          '100%': { boxShadow: '0 0 10px #ec4899, 0 0 20px #ec4899, 0 0 30px #ec4899' },
        },
      },
    },
  },
  plugins: [],
}
