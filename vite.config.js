import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const page = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        home: page('./index.html'),
        about: page('./about/index.html'),
        projects: page('./projects/index.html'),
        links: page('./links/index.html'),
      },
    },
  },
});
