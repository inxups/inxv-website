import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const bundleName = (await readdir(join(dist, 'assets'))).find((name) => /^main-.*\.js$/.test(name));
const bundle = await readFile(join(dist, 'assets', bundleName), 'utf8');
const projects = JSON.parse(await readFile(new URL('../assets/projects.generated.json', import.meta.url), 'utf8'));

async function waitFor(check) {
  const deadline = Date.now() + 2000;
  while (!check()) {
    if (Date.now() > deadline) assert.fail('页面没有在预期时间内更新');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function mount(route = '/', { navigationType = 'navigate', historyState = null } = {}) {
  const file = route === '/' ? 'index.html' : join(route.slice(1), 'index.html');
  const html = await readFile(join(dist, file), 'utf8');
  const dom = new JSDOM(html, {
    url: `https://example.com/site${route}`,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  dom.window.matchMedia = () => ({ matches: false });
  dom.window.performance.getEntriesByType = (type) => type === 'navigation' ? [{ type: navigationType }] : [];
  if (historyState) dom.window.history.replaceState(historyState, '', dom.window.location.href);
  dom.window.eval(bundle);
  await waitFor(() => dom.window.document.querySelector('#command-input'));
  return dom;
}

async function typeCommand(dom, command) {
  const input = dom.window.document.querySelector('#command-input');
  const setValue = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
  setValue.call(input, command);
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  input.form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
}

test('each built page opens with a terminal prompt and reads its content on command', async () => {
  for (const [route, title] of [
    ['/', '首页'],
    ['/about/', '关于我'],
    ['/projects/', '项目'],
    ['/links/', '友情链接'],
  ]) {
    const dom = await mount(route);
    try {
      const { document } = dom.window;
      const main = document.querySelector('main');
      assert.equal(main.querySelector('.page-response'), null);
      assert.equal(main.querySelector('.command-echo'), null);
      assert.equal(main.querySelector('.command-hint').textContent, '#试试help?');
      assert.equal(main.querySelectorAll('#command-input').length, 1);
      assert.equal(main.querySelector('.prompt-path').textContent, route === '/' ? '~' : `~${route.slice(0, -1)}`);

      await typeCommand(dom, 'cat README.md');
      await waitFor(() => main.querySelector('.command-echo'));
      if (route === '/') {
        assert.equal(main.querySelector('.page-response'), null);
      } else {
        assert.equal(main.querySelector('.page-title').textContent, title);
      }
      assert.equal(main.querySelectorAll('#command-input').length, 1);
      assert.equal(main.querySelector('.command-hint'), null);
    } finally {
      dom.window.close();
    }
  }
});

test('directory commands update the URL, page, and browser history', async () => {
  const dom = await mount();
  try {
    const { document, history, location } = dom.window;
    await waitFor(() => history.state?.inxv);

    document.querySelector('[data-command="cd about"]').click();
    await waitFor(() => location.pathname === '/site/about/');
    assert.equal(document.querySelectorAll('#command-input').length, 1);
    assert.equal(document.querySelector('.page-title').textContent, '关于我');
    assert.equal(document.title, '关于我 | inxv');

    history.back();
    await waitFor(() => location.pathname === '/site/');
    await waitFor(() => document.querySelector('.command-form .prompt-path').textContent === '~');
    assert.equal(document.querySelectorAll('.page-title').length, 1);
    assert.equal(document.querySelector('.transcript-block:last-child .page-response'), null);
    assert.equal(document.querySelectorAll('#command-input').length, 1);
  } finally {
    dom.window.close();
  }
});

test('projects render the generated snapshot with safe external links and optional descriptions', async () => {
  const dom = await mount('/projects/');
  try {
    await typeCommand(dom, 'cat README.md');
    const { document } = dom.window;
    await waitFor(() => document.querySelector('.page-response'));
    const rows = [...document.querySelectorAll('.content-row')];
    assert.equal(rows.length, projects.length);
    projects.forEach((project, index) => {
      const link = rows[index].querySelector('.content-title');
      assert.equal(link.textContent, project.title);
      assert.equal(link.href, project.url);
      assert.equal(link.target, '_blank');
      assert.equal(link.rel, 'noopener noreferrer');
      assert.equal(rows[index].querySelector('.content-description')?.textContent ?? '', project.description);
      if (!project.description) assert.equal(rows[index].querySelector('.content-description'), null);
    });
    assert.equal(document.querySelectorAll('#command-input').length, 1);
  } finally {
    dom.window.close();
  }
});

test('file explorer lists every page and expands the current page after commands', async () => {
  const dom = await mount();
  try {
    const { document, location } = dom.window;
    const directory = (route) => document.querySelector(`.tree-directory[data-command="cd ${route}"]`);

    assert.equal(document.querySelector('.tree-root').textContent.trim(), '~/');
    assert.deepEqual(
      [...document.querySelectorAll('.tree-directory-name')].map((item) => item.textContent),
      ['about/', 'projects/', 'links/'],
    );
    assert.equal(document.querySelectorAll('.tree-files').length, 0);

    await typeCommand(dom, 'cd projects');
    await waitFor(() => location.pathname === '/site/projects/');
    assert.equal(directory('projects').getAttribute('aria-expanded'), 'true');
    assert.equal(directory('about').getAttribute('aria-expanded'), 'false');
    assert.equal(document.querySelector('.tree-files .tree-file').textContent.trim(), 'mdREADME.md');

    await typeCommand(dom, 'cd links');
    await waitFor(() => location.pathname === '/site/links/');
    assert.equal(directory('projects').getAttribute('aria-expanded'), 'false');
    assert.equal(directory('links').getAttribute('aria-expanded'), 'true');

    await typeCommand(dom, 'cd /');
    await waitFor(() => location.pathname === '/site/');
    assert.equal(document.querySelectorAll('.tree-files').length, 0);
    assert.equal(document.querySelector('.transcript-block:last-child .page-response'), null);
    assert.equal(document.querySelector('.command-form .prompt-path').textContent, '~');

    await typeCommand(dom, 'help');
    await waitFor(() => document.querySelector('.help-response'));
    assert.equal(document.querySelectorAll('#command-input').length, 1);
  } finally {
    dom.window.close();
  }
});

test('reloading resets the terminal, URL, and file explorer to the root directory', async () => {
  const dom = await mount();
  let reloaded;
  try {
    await typeCommand(dom, 'cd projects');
    await waitFor(() => dom.window.document.querySelector('.tree-files'));
    const route = dom.window.location.pathname.slice('/site'.length);
    reloaded = await mount(route, { navigationType: 'reload', historyState: dom.window.history.state });

    const { document, history, location } = reloaded.window;
    await waitFor(() => location.pathname === '/site/' && document.title === 'inxv | terminal');
    assert.equal(document.querySelector('.prompt-path').textContent, '~');
    assert.equal(document.querySelector('.command-hint').textContent, '#试试help?');
    assert.equal(document.querySelectorAll('.transcript-block').length, 0);
    assert.equal(document.querySelectorAll('.tree-files').length, 0);
    assert.equal(document.querySelectorAll('.tree-directory[aria-expanded="true"]').length, 0);
    assert.ok(document.querySelector('.tree-root.is-current'));
    assert.equal(history.state.index, 0);

    document.querySelector('.tree-directory[data-command="cd links"]').click();
    await waitFor(() => document.querySelector('.page-title')?.textContent === '友情链接');
    assert.equal(location.pathname, '/site/links/');
    assert.equal(document.querySelector('.tree-directory[data-command="cd links"]').getAttribute('aria-expanded'), 'true');
  } finally {
    dom.window.close();
    reloaded?.window.close();
  }
});

test('typed commands update output and keep one usable prompt after clear', async () => {
  const dom = await mount();
  try {
    const { document } = dom.window;
    await typeCommand(dom, 'help');
    await waitFor(() => document.querySelector('.help-response'));
    assert.deepEqual(
      [...document.querySelectorAll('.help-command')].map((row) => row.textContent),
      ['help', 'ls', 'cd <目录>', 'cat README.md', 'clear'],
    );
    assert.equal(document.querySelector('.command-hint'), null);

    await typeCommand(dom, 'clear');
    await waitFor(() => document.querySelectorAll('.transcript-block').length === 0);
    assert.equal(document.querySelectorAll('#command-input').length, 1);
    assert.equal(document.querySelector('.command-hint'), null);

    await typeCommand(dom, 'ls');
    await waitFor(() => document.querySelector('.listing-response'));
    assert.deepEqual(
      [...document.querySelectorAll('.listing-response .listing-name')].map((row) => row.textContent),
      ['about/', 'projects/', 'links/'],
    );
    assert.equal(document.querySelector('.listing-response button, .listing-response a, .listing-response [data-command]'), null);
    document.querySelector('.listing-name').click();
    assert.equal(dom.window.location.pathname, '/site/');
    assert.equal(document.querySelectorAll('#command-input').length, 1);

    await typeCommand(dom, 'cd projects');
    await waitFor(() => dom.window.location.pathname === '/site/projects/');
    await typeCommand(dom, 'ls');
    await waitFor(() => document.querySelectorAll('.listing-response').length === 2);
    const listing = document.querySelectorAll('.listing-response')[1];
    assert.deepEqual([...listing.querySelectorAll('.listing-name')].map((row) => row.textContent), ['../', 'README.md']);
    assert.equal(listing.querySelector('button, a, [data-command]'), null);
    listing.querySelector('.listing-name').click();
    assert.equal(dom.window.location.pathname, '/site/projects/');
  } finally {
    dom.window.close();
  }
});
