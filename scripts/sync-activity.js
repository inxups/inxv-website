import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const activityFile = fileURLToPath(new URL('../assets/github-activity.generated.json', import.meta.url));
const dayLength = 86_400_000;

export function isActivity(value, username = 'inxups') {
  return value?.username === username && /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(username)
    && Array.isArray(value.days) && value.days.length >= 365 && value.days.length <= 371
    && value.days.every((day, index, days) => {
      const time = Date.parse(`${day?.date}T00:00:00Z`);
      return /^\d{4}-\d{2}-\d{2}$/.test(day?.date) && Number.isFinite(time)
        && new Date(time).toISOString().slice(0, 10) === day.date
        && Number.isSafeInteger(day.count) && day.count >= 0
        && Number.isInteger(day.level) && day.level >= 0 && day.level <= 4
        && (day.count === 0) === (day.level === 0)
        && (!index || time - Date.parse(`${days[index - 1].date}T00:00:00Z`) === dayLength);
    })
    && Number.isSafeInteger(value.total)
    && value.total === value.days.reduce((sum, day) => sum + day.count, 0);
}

export function parseActivity(html, username = 'inxups') {
  const dom = new JSDOM(html);
  try {
    const { document } = dom.window;
    const tooltips = new Map([...document.querySelectorAll('tool-tip[for]')]
      .map((tip) => [tip.getAttribute('for'), tip.textContent.trim()]));
    const days = [...document.querySelectorAll('.ContributionCalendar-day[data-date]')].map((cell) => {
      const tooltip = tooltips.get(cell.id) || '';
      const match = tooltip.match(/^(No|\d[\d,]*) contributions? on\b/);
      if (!match) throw new Error(`Missing contribution count for ${cell.dataset.date}`);
      return {
        date: cell.dataset.date,
        count: match[1] === 'No' ? 0 : Number(match[1].replaceAll(',', '')),
        level: Number(cell.dataset.level),
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
    const activity = { username, total: days.reduce((sum, day) => sum + day.count, 0), days };
    if (!isActivity(activity, username)) throw new Error('Incomplete or invalid contribution calendar');
    return activity;
  } finally {
    dom.window.close();
  }
}

export async function syncActivity({ file = activityFile, username = 'inxups', fetchImpl = fetch, logger = console } = {}) {
  let previous;
  try {
    previous = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  let activity;
  try {
    const response = await fetchImpl(new URL(`https://github.com/users/${encodeURIComponent(username)}/contributions`), {
      headers: { Accept: 'text/html', 'Accept-Language': 'en', 'User-Agent': 'inxv-activity-sync' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);
    activity = parseActivity(await response.text(), username);
  } catch (error) {
    let saved;
    try { saved = JSON.parse(previous); } catch { /* No usable snapshot. */ }
    if (!isActivity(saved, username)) throw error;
    logger.warn(`GitHub activity sync failed (${error.message}); keeping saved activity.`);
    return { activity: saved, changed: false, fallback: true };
  }

  const next = `${JSON.stringify(activity, null, 2)}\n`;
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
  logger.log(`Synced ${activity.days.length} days of GitHub activity${changed ? '' : ' (unchanged)'}.`);
  return { activity, changed, fallback: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  syncActivity().catch((error) => {
    console.error(`GitHub activity sync failed: ${error.message}`);
    process.exitCode = 1;
  });
}
