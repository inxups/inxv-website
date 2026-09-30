import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fetchProjects, syncProjects } from './sync-projects.js';

const repository = (name, properties = {}) => ({
  name,
  description: `Description of ${name}`,
  html_url: `https://github.com/inxups/${name}`,
  pushed_at: '2026-01-01T00:00:00Z',
  private: false,
  fork: false,
  archived: false,
  stargazers_count: 12,
  forks_count: 3,
  default_branch: 'main',
  ...properties,
});
const response = (data, status = 200) => ({ ok: status === 200, status, json: async () => data });
const savedProjects = [{ title: 'saved', description: '', url: 'https://github.com/inxups/saved' }];

const withMissingDetails = (fetchRepositories) => async (url, options) =>
  url.pathname.startsWith('/users/') ? fetchRepositories(url, options) : response(null, 404);

async function snapshot(t, contents) {
  const directory = await mkdtemp(join(tmpdir(), 'inxv-project-sync-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'projects.json');
  if (contents !== undefined) await writeFile(file, contents);
  return file;
}

test('fetches all pages, retains forks and archives, and sorts by push date then name', async () => {
  const firstPage = Array.from({ length: 100 }, (_, index) => repository(`old-${index}`, { pushed_at: null }));
  const secondPage = [
    repository('z-fork', { fork: true, pushed_at: '2026-09-01T00:00:00Z' }),
    repository('a-archived', { archived: true, description: null, pushed_at: '2026-09-01T00:00:00Z' }),
    repository('newest', { pushed_at: '2026-09-02T00:00:00Z' }),
  ];
  const requests = [];
  const projects = await fetchProjects({
    token: 'test-token',
    fetchImpl: withMissingDetails(async (url, options) => {
      requests.push({ url, options });
      return response(requests.length === 1 ? firstPage : secondPage);
    }),
  });
  assert.equal(projects.length, 103);
  assert.deepEqual(projects.slice(0, 3).map((project) => project.title), ['newest', 'a-archived', 'z-fork']);
  assert.equal(projects[1].description, '');
  assert.equal(projects[2].url, 'https://github.com/inxups/z-fork');
  assert.equal(projects[2].isFork, true);
  assert.equal(projects[2].stars, 12);
  assert.equal(projects[2].forks, 3);
  assert.equal(projects[2].readme, null);
  assert.equal(projects[2].release, null);
  assert.deepEqual(requests.map(({ url }) => url.searchParams.get('page')), ['1', '2']);
  assert.ok(requests.every(({ url }) => url.searchParams.get('per_page') === '100'));
  assert.equal(requests[0].options.headers.Authorization, 'Bearer test-token');
});

test('does not publish private repositories or accept a malformed API response', async () => {
  assert.deepEqual(await fetchProjects({ fetchImpl: async () => response([repository('private', { private: true })]) }), []);
  await assert.rejects(fetchProjects({ fetchImpl: async () => response({ message: 'error' }) }), /Invalid repository list/);
  await assert.rejects(fetchProjects({ fetchImpl: async () => response([repository('broken', { html_url: 'javascript:alert(1)' })]) }), /Invalid repository data/);
  await assert.rejects(fetchProjects({ fetchImpl: async () => response([], 403) }), /HTTP 403/);
});

test('saves successful results and does not rewrite identical data', async (t) => {
  const file = await snapshot(t);
  const fetchImpl = withMissingDetails(async () => response([repository('sample')]));
  const logger = { log() {} };
  const first = await syncProjects({ file, fetchImpl, logger });
  assert.equal(first.changed, true);
  assert.equal(first.fallback, false);
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), first.projects);
  const second = await syncProjects({ file, fetchImpl, logger });
  assert.equal(second.changed, false);
});

test('keeps the complete saved snapshot if a later page fails', async (t) => {
  const original = `${JSON.stringify(savedProjects)}\n`;
  const file = await snapshot(t, original);
  const warnings = [];
  let requests = 0;
  const result = await syncProjects({
    file,
    fetchImpl: async () => ++requests === 1
      ? response(Array.from({ length: 100 }, (_, index) => repository(`partial-${index}`)))
      : response([], 503),
    logger: { warn: (message) => warnings.push(message) },
  });
  assert.equal(result.fallback, true);
  assert.equal(result.changed, false);
  assert.deepEqual(result.projects, savedProjects);
  assert.equal(await readFile(file, 'utf8'), original);
  assert.match(warnings[0], /HTTP 503.*keeping 1 saved projects/);
});

test('fails without a usable snapshot and does not overwrite corrupt data', async (t) => {
  const fetchImpl = async () => { throw new Error('network unavailable'); };
  for (const contents of [undefined, 'not json', '[{}]']) {
    const file = await snapshot(t, contents);
    await assert.rejects(syncProjects({ file, fetchImpl }), /network unavailable/);
    if (contents !== undefined) assert.equal(await readFile(file, 'utf8'), contents);
  }
});

test('accepts an empty successful list and can reuse it after a network failure', async (t) => {
  const file = await snapshot(t, JSON.stringify(savedProjects));
  const result = await syncProjects({ file, fetchImpl: async () => response([]), logger: { log() {} } });
  assert.deepEqual(result.projects, []);
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), []);
  const fallback = await syncProjects({ file, fetchImpl: async () => response([], 429), logger: { warn() {} } });
  assert.equal(fallback.fallback, true);
  assert.deepEqual(fallback.projects, []);
});

test('downloads the README as UTF-8 and keeps the latest release and download links', async () => {
  const projects = await fetchProjects({
    fetchImpl: async (url) => {
      if (url.pathname.startsWith('/users/')) return response([repository('sample')]);
      if (url.pathname.endsWith('/readme')) return response({
        encoding: 'base64', content: Buffer.from('# 项目\n\n说明').toString('base64'),
        path: 'docs/README.md', html_url: 'https://github.com/inxups/sample/blob/main/docs/README.md',
        download_url: 'https://raw.githubusercontent.com/inxups/sample/main/docs/README.md',
      });
      assert.ok(url.pathname.endsWith('/releases/latest'));
      return response({
        name: 'First release', tag_name: 'v1.0.0', published_at: '2026-09-30T00:00:00Z',
        html_url: 'https://github.com/inxups/sample/releases/tag/v1.0.0', body: '## Changes\n\nNew feature.',
        assets: [{ name: 'sample.zip', browser_download_url: 'https://github.com/inxups/sample/releases/download/v1.0.0/sample.zip' }],
      });
    },
  });
  assert.equal(projects[0].readme.content, '# 项目\n\n说明');
  assert.equal(projects[0].readme.path, 'docs/README.md');
  assert.equal(projects[0].release.tag, 'v1.0.0');
  assert.equal(projects[0].release.assets[0].name, 'sample.zip');
});

test('retains saved detail fields on transient failures while updating repository counts', async () => {
  const previous = { ...savedProjects[0], readme: { content: '# Saved' }, release: null };
  const warnings = [];
  const projects = await fetchProjects({
    previousProjects: [previous],
    logger: { warn: (message) => warnings.push(message) },
    fetchImpl: async (url) => url.pathname.startsWith('/users/')
      ? response([repository('saved', { stargazers_count: 99, forks_count: 8 })])
      : response(null, 503),
  });
  assert.equal(projects[0].stars, 99);
  assert.equal(projects[0].forks, 8);
  assert.deepEqual(projects[0].readme, previous.readme);
  assert.equal(projects[0].release, null);
  assert.equal(warnings.length, 2);
});

test('does not save incomplete details when no saved field is available', async (t) => {
  const original = JSON.stringify(savedProjects);
  const file = await snapshot(t, original);
  const result = await syncProjects({
    file,
    logger: { warn() {} },
    fetchImpl: async (url) => url.pathname.startsWith('/users/') ? response([repository('new')]) : response(null, 503),
  });
  assert.equal(result.fallback, true);
  assert.equal(await readFile(file, 'utf8'), original);
});
