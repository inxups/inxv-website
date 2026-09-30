import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import projects from '../assets/projects.generated.json' with { type: 'json' };

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

export function projectHtml(template, project) {
  return template.replaceAll('"../', '"../../')
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(project.title)} | inxv</title>`)
    .replace(/(<meta name="description" content=")[^"]*("\s*\/?>)/,
      (_, prefix, suffix) => `${prefix}${escapeHtml(project.description || `${project.title} 项目。`)}${suffix}`);
}

export async function buildProjectPages() {
  const dist = fileURLToPath(new URL('../dist/', import.meta.url));
  const template = await readFile(join(dist, 'projects/index.html'), 'utf8');
  for (const project of projects) {
    if (!/^[\w.-]+$/.test(project.title) || ['.', '..'].includes(project.title)) throw new Error('Invalid project route');
    const directory = join(dist, 'projects', project.title);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'index.html'), projectHtml(template, project));
  }
  console.log(`Built ${projects.length} project detail pages.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildProjectPages().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
