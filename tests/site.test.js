import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const bundleName = (await readdir(join(dist, 'assets'))).find((name) => /^main-.*\.js$/.test(name));
const bundle = await readFile(join(dist, 'assets', bundleName), 'utf8');

async function waitFor(check) {
  const deadline = Date.now() + 2000;
  while (!check()) {
    if (Date.now() > deadline) assert.fail('页面没有在预期时间内更新');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function mount(route = '/') {
  const file = route === '/' ? 'index.html' : join(route.slice(1), 'index.html');
  const html = await readFile(join(dist, file), 'utf8');
  const dom = new JSDOM(html, {
    url: `https://example.com/site${route}`,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  dom.window.matchMedia = () => ({ matches: false });
  dom.window.eval(bundle);
  await waitFor(() => dom.window.document.querySelector('.page-title'));
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

test('each built page renders its own content on direct load', async () => {
  for (const [route, title] of [
    ['/', '首页'],
    ['/about/', '关于我'],
    ['/projects/', '项目'],
    ['/links/', '友情链接'],
  ]) {
    const dom = await mount(route);
    try {
      assert.equal(dom.window.document.querySelector('.page-title').textContent, title);
      assert.ok(dom.window.document.querySelector('#command-input'));
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
    assert.equal(document.querySelectorAll('.page-title')[1].textContent, '关于我');
    assert.equal(document.title, '关于我 | inxv');

    history.back();
    await waitFor(() => location.pathname === '/site/');
    await waitFor(() => document.querySelectorAll('.page-title').length === 3);
    assert.equal(document.querySelectorAll('.page-title')[2].textContent, '首页');
  } finally {
    dom.window.close();
  }
});

test('typed commands update output and keep one usable prompt after clear', async () => {
  const dom = await mount();
  try {
    const { document } = dom.window;
    await typeCommand(dom, 'pwd');
    await waitFor(() => document.querySelectorAll('.notice').length === 1);
    assert.equal(document.querySelector('.notice').textContent, '/');

    await typeCommand(dom, 'clear');
    await waitFor(() => document.querySelectorAll('.transcript-block').length === 0);
    assert.equal(document.querySelectorAll('#command-input').length, 1);

    await typeCommand(dom, 'history');
    await waitFor(() => document.querySelectorAll('.history-row').length === 3);
    assert.deepEqual(
      [...document.querySelectorAll('.history-row span:last-child')].map((row) => row.textContent),
      ['pwd', 'clear', 'history'],
    );
  } finally {
    dom.window.close();
  }
});
