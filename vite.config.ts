import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [vue()],
  assetsInclude: ['**/*.glb'],
  server: {
    host: '0.0.0.0',
    port: 5100,
  },
  preview: {
    host: '0.0.0.0',
    port: 5100,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
