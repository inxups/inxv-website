import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import MarkdownContent from './MarkdownContent.js';
import { markdownUrl } from './markdown-url.js';

const project = {
  title: 'sample', url: 'https://github.com/inxups/sample', defaultBranch: 'main',
  readme: {
    url: 'https://github.com/inxups/sample/blob/main/docs/README.md',
    downloadUrl: 'https://raw.githubusercontent.com/inxups/sample/main/docs/README.md',
  },
};

test('Markdown URLs resolve nested repository paths, raw images, and safe protocols', () => {
  assert.equal(markdownUrl('./guide.md', project), 'https://github.com/inxups/sample/blob/main/docs/guide.md');
  assert.equal(markdownUrl('../LICENSE', project), 'https://github.com/inxups/sample/blob/main/LICENSE');
  assert.equal(markdownUrl('/assets/logo.png?raw=1', project, { image: true }), 'https://github.com/inxups/sample/raw/main/assets/logo.png?raw=1');
  assert.equal(markdownUrl('./logo.png', project, { image: true }), 'https://raw.githubusercontent.com/inxups/sample/main/docs/logo.png');
  assert.equal(markdownUrl('https://example.com/image.png', project, { image: true }), 'https://example.com/image.png');
  assert.equal(markdownUrl('mailto:hello@example.com', project), 'mailto:hello@example.com');
  assert.equal(markdownUrl('javascript:alert(1)', project), '');
  assert.equal(markdownUrl('data:text/html,script', project), '');
});

test('renders GFM tables, code, images, and heading anchors while stripping unsafe HTML', () => {
  const content = [
    '# Install', '', '[Jump](#install)', '', '[Guide](./guide.md)', '',
    '![Logo](./logo.png)', '', '| Name | Value |', '| --- | --- |', '| Star | 10 |', '',
    '```sh', 'npm install', '```', '',
    '<script>alert(1)</script>', '<img src="./logo.png" onerror="alert(1)">',
    '<a href="javascript:alert(1)">Unsafe</a>',
  ].join('\n');
  const html = renderToStaticMarkup(createElement(MarkdownContent, { content, project }));
  const dom = new JSDOM(html);
  try {
    const { document } = dom.window;
    assert.ok(document.querySelector('.markdown-table table'));
    assert.equal(document.querySelector('pre code').textContent.trim(), 'npm install');
    assert.equal(document.querySelector('img').src, 'https://raw.githubusercontent.com/inxups/sample/main/docs/logo.png');
    assert.equal(document.querySelector('img').getAttribute('loading'), 'lazy');
    assert.equal(document.querySelector('script, [onerror], [onclick]'), null);
    assert.equal([...document.querySelectorAll('a')].some((link) => link.href.startsWith('javascript:')), false);
    const anchor = [...document.querySelectorAll('a')].find((link) => link.textContent === 'Jump');
    assert.equal(anchor.getAttribute('href'), `#${document.querySelector('h1').id}`);
    assert.equal(anchor.target, '');
    const guide = [...document.querySelectorAll('a')].find((link) => link.textContent === 'Guide');
    assert.equal(guide.target, '_blank');
    assert.equal(guide.rel, 'noopener noreferrer');
  } finally { dom.window.close(); }
});

test('keeps footnotes and HTML anchor targets within the project document', () => {
  const content = 'Text[^note]\n\n[^note]: Footnote content.\n\n<a id="custom"></a>\n\n[Custom](#custom)';
  const html = renderToStaticMarkup(createElement(MarkdownContent, { content, project }));
  const dom = new JSDOM(html);
  try {
    const { document } = dom.window;
    const anchors = [...document.querySelectorAll('a[href^="#"]')];
    assert.ok(anchors.length >= 3);
    for (const anchor of anchors) assert.ok(document.getElementById(anchor.getAttribute('href').slice(1)));
  } finally { dom.window.close(); }
});
