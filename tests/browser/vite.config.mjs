// Isolated real-component fixtures: no app assets, API keys or production config needed.
import { defineConfig } from 'vite';
export default defineConfig({
  root: process.cwd(),
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': process.cwd() }, dedupe: ['react', 'react-dom'] },
  server: { host: '127.0.0.1', strictPort: true },
});
