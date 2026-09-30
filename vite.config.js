import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';
import projects from './assets/projects.generated.json' with { type: 'json' };
import { projectHtml } from './scripts/build-project-pages.js';

const page = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react(), {
    name: 'project-detail-pages',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        try {
          const url = new URL(request.url, 'http://localhost');
          const match = url.pathname.match(/^\/projects\/([^/]+)(?:\/(?:index\.html)?)?$/);
          const project = match && projects.find((item) => item.title === decodeURIComponent(match[1]));
          if (!project) return next();
          if (!url.pathname.endsWith('/') && !url.pathname.endsWith('index.html')) {
            response.writeHead(302, { Location: `${url.pathname}/${url.search}` });
            response.end();
            return;
          }
          const template = await readFile(page('./projects/index.html'), 'utf8');
          const html = await server.transformIndexHtml(url.pathname, projectHtml(template, project));
          response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          response.end(html);
        } catch (error) { next(error); }
      });
    },
  }],
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
