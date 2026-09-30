import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectsFile = fileURLToPath(new URL('../assets/projects.generated.json', import.meta.url));

export async function fetchProjects({ username = 'inxups', token, fetchImpl = fetch, previousProjects = [], logger = console } = {}) {
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
      if (typeof repository.name !== 'string' || !/^[\w.-]+$/.test(repository.name) || ['.', '..'].includes(repository.name)
        || typeof repository.html_url !== 'string'
        || !repository.html_url.startsWith(`https://github.com/${username}/`)
        || (repository.description !== null && typeof repository.description !== 'string')) {
        throw new Error(`Invalid repository data on page ${page}`);
      }
      repositories.push(repository);
    }
    if (batch.length < 100) break;
  }

  const sorted = repositories
    .sort((a, b) => (Date.parse(b.pushed_at) || 0) - (Date.parse(a.pushed_at) || 0)
      || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const saved = new Map(previousProjects.map((project) => [project.title, project]));
  const projects = new Array(sorted.length);
  let cursor = 0;

  async function detail(repository, field, endpoint, map) {
    try {
      const url = `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repository.name)}/${endpoint}`;
      const response = await fetchImpl(new URL(url), { headers, signal: AbortSignal.timeout(30_000) });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);
      return map(await response.json());
    } catch (error) {
      const cached = saved.get(repository.name);
      if (cached && Object.hasOwn(cached, field)) {
        logger.warn(`${repository.name}: ${field} sync failed (${error.message}); keeping saved content.`);
        return cached[field];
      }
      throw new Error(`${repository.name}: ${field} sync failed (${error.message})`);
    }
  }

  await Promise.all(Array.from({ length: Math.min(4, sorted.length) }, async () => {
    while (cursor < sorted.length) {
      const index = cursor++;
      const repository = sorted[index];
      const [readme, release] = await Promise.all([
        detail(repository, 'readme', 'readme', (data) => {
          if (data.encoding !== 'base64' || typeof data.content !== 'string'
            || typeof data.path !== 'string' || typeof data.html_url !== 'string'
            || typeof data.download_url !== 'string') throw new Error('Invalid README response');
          return {
            content: Buffer.from(data.content, 'base64').toString('utf8'),
            path: data.path,
            url: data.html_url,
            downloadUrl: data.download_url,
          };
        }),
        detail(repository, 'release', 'releases/latest', (data) => {
          if (typeof data.tag_name !== 'string' || typeof data.html_url !== 'string'
            || typeof data.published_at !== 'string' || !Array.isArray(data.assets)) throw new Error('Invalid release response');
          return {
            name: data.name || data.tag_name,
            tag: data.tag_name,
            url: data.html_url,
            publishedAt: data.published_at,
            body: data.body || '',
            assets: data.assets.map((asset) => ({ name: asset.name, url: asset.browser_download_url })),
          };
        }),
      ]);
      projects[index] = {
        title: repository.name,
        description: repository.description ?? '',
        url: repository.html_url,
        stars: repository.stargazers_count ?? 0,
        forks: repository.forks_count ?? 0,
        isFork: repository.fork === true,
        defaultBranch: repository.default_branch || 'main',
        readme,
        release,
      };
    }
  }));
  return projects;
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
    let cached;
    try { cached = JSON.parse(previous); } catch { /* First sync. */ }
    projects = await fetchProjects({ previousProjects: isProjectList(cached) ? cached : [], logger, ...options });
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
