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
  ...properties,
});
const response = (data, status = 200) => ({ ok: status === 200, status, json: async () => data });
const savedProjects = [{ title: 'saved', description: '', url: 'https://github.com/inxups/saved' }];

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
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return response(requests.length === 1 ? firstPage : secondPage);
    },
  });
  assert.equal(projects.length, 103);
  assert.deepEqual(projects.slice(0, 3).map((project) => project.title), ['newest', 'a-archived', 'z-fork']);
  assert.equal(projects[1].description, '');
  assert.equal(projects[2].url, 'https://github.com/inxups/z-fork');
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
  const fetchImpl = async () => response([repository('sample')]);
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
