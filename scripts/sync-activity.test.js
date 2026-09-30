import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { isActivity, parseActivity, syncActivity } from './sync-activity.js';

const days = Array.from({ length: 365 }, (_, index) => ({
  date: new Date(Date.UTC(2025, 9, 1) + index * 86_400_000).toISOString().slice(0, 10),
  count: index === 100 ? 1234 : index === 364 ? 1 : 0,
  level: index === 100 ? 4 : index === 364 ? 1 : 0,
}));
const activity = { username: 'inxups', total: 1235, days };
// GitHub emits weekday rows, rather than chronological days.
const html = [...days].reverse().map((day, index) => `
  <svg><rect class="ContributionCalendar-day" data-date="${day.date}" data-level="${day.level}" id="day-${index}"></rect></svg>
  <tool-tip for="day-${index}">${day.count === 0 ? 'No contributions' : `${day.count.toLocaleString('en-US')} contribution${day.count === 1 ? '' : 's'}`} on September 30th.</tool-tip>
`).join('');
const response = (text = html, status = 200) => ({ ok: status === 200, status, text: async () => text });

async function snapshot(t, contents) {
  const directory = await mkdtemp(join(tmpdir(), 'inxv-activity-sync-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'activity.json');
  if (contents !== undefined) await writeFile(file, contents);
  return file;
}

test('parses GitHub daily counts, thousands separators and color levels in date order', () => {
  assert.deepEqual(parseActivity(html), activity);
  assert.equal(isActivity(activity), true);
  assert.equal(isActivity({ ...activity, username: 'someone-else' }), false);
  assert.equal(isActivity({ ...activity, days: days.filter((_, index) => index !== 1) }), false);
  assert.throws(() => parseActivity(html.replace('data-level="1"', 'data-level="9"')), /invalid contribution/);
  assert.throws(() => parseActivity(html.replace('1 contribution on', 'Unknown contribution on')), /Missing contribution count/);
  assert.throws(() => parseActivity('<html>Sign in</html>'), /Incomplete/);
  const duplicate = { ...activity, days: days.map((day, index) => index === 1 ? days[0] : day) };
  assert.equal(isActivity(duplicate), false);
});

test('saves a complete activity snapshot without credentials or redundant rewrites', async (t) => {
  const file = await snapshot(t);
  const fetchImpl = async (url, options) => {
    assert.equal(url.href, 'https://github.com/users/inxups/contributions');
    assert.equal(options.headers['Accept-Language'], 'en');
    assert.equal(options.headers.Authorization, undefined);
    return response();
  };
  const first = await syncActivity({ file, fetchImpl, logger: { log() {} } });
  assert.equal(first.changed, true);
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), activity);
  const second = await syncActivity({ file, fetchImpl, logger: { log() {} } });
  assert.equal(second.changed, false);
});

test('keeps saved activity on HTTP errors or a partial calendar', async (t) => {
  const original = `${JSON.stringify(activity)}\n`;
  const file = await snapshot(t, original);
  for (const fetchImpl of [async () => response('', 503), async () => response(html.slice(0, 1000))]) {
    const result = await syncActivity({ file, fetchImpl, logger: { warn() {} } });
    assert.equal(result.fallback, true);
    assert.deepEqual(result.activity, activity);
    assert.equal(await readFile(file, 'utf8'), original);
  }
});

test('fails instead of publishing invented or corrupt activity without a valid snapshot', async (t) => {
  for (const contents of [undefined, 'not json', JSON.stringify({ ...activity, username: 'wrong-user' })]) {
    const file = await snapshot(t, contents);
    await assert.rejects(syncActivity({ file, fetchImpl: async () => response('', 429) }), /HTTP 429/);
    if (contents !== undefined) assert.equal(await readFile(file, 'utf8'), contents);
  }
});
