import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectsFile = fileURLToPath(new URL('../assets/projects.generated.json', import.meta.url));

export async function fetchProjects({ username = 'inxups', token, fetchImpl = fetch } = {}) {
  const repositories = [];
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'inxv-project-sync',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  for (let page = 1; ; page += 1) {
    const url = new URL(`https://api.github.com/users/${encodeURIComponent(username)}/repos`);
    url.search = new URLSearchParams({ type: 'owner', sort: 'pushed', direction: 'desc', per_page: '100', page: String(page) });
    const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status} on page ${page}`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error(`Invalid repository list on page ${page}`);

    for (const repository of batch) {
      if (repository.private === true) continue;
      if (typeof repository.name !== 'string' || !repository.name
        || typeof repository.html_url !== 'string'
        || !repository.html_url.startsWith(`https://github.com/${username}/`)
        || (repository.description !== null && typeof repository.description !== 'string')) {
        throw new Error(`Invalid repository data on page ${page}`);
      }
      repositories.push(repository);
    }
    if (batch.length < 100) break;
  }

  return repositories
    .sort((a, b) => (Date.parse(b.pushed_at) || 0) - (Date.parse(a.pushed_at) || 0)
      || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((repository) => ({
      title: repository.name,
      description: repository.description ?? '',
      url: repository.html_url,
    }));
}

function isProjectList(value) {
  return Array.isArray(value) && value.every((item) => item
    && typeof item.title === 'string' && item.title.length > 0
    && typeof item.description === 'string'
    && typeof item.url === 'string' && item.url.startsWith('https://github.com/'));
}

export async function syncProjects({ file = projectsFile, logger = console, ...options } = {}) {
  let previous;
  try {
    previous = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  let projects;
  try {
    projects = await fetchProjects(options);
  } catch (error) {
    let cached;
    try { cached = JSON.parse(previous); } catch { /* No usable snapshot. */ }
    if (!isProjectList(cached)) throw error;
    logger.warn(`GitHub project sync failed (${error.message}); keeping ${cached.length} saved projects.`);
    return { projects: cached, changed: false, fallback: true };
  }

  const next = `${JSON.stringify(projects, null, 2)}\n`;
  const changed = next !== previous;
  if (changed) {
    const temporaryFile = `${file}.tmp-${process.pid}`;
    try {
      await writeFile(temporaryFile, next, 'utf8');
      await rename(temporaryFile, file);
    } finally {
      await rm(temporaryFile, { force: true });
    }
  }
  logger.log(`Synced ${projects.length} public GitHub projects${changed ? '' : ' (unchanged)'}.`);
  return { projects, changed, fallback: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  syncProjects({ token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN }).catch((error) => {
    console.error(`GitHub project sync failed: ${error.message}`);
    process.exitCode = 1;
  });
}
