import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/little-code-sauce/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react')) {
            return 'vendor';
          }
          if (id.includes('node_modules/monaco-editor')) {
            return 'monaco';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
})
