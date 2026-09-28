import { siteContent } from './content.js';

const app = document.querySelector('#app');
const baseUrl = new URL('../', import.meta.url);
const pages = new Map([
  ['', { title: '首页', file: '/README.md' }],
  ['about', { title: '关于我', file: '/about/README.md' }],
  ['projects', { title: '项目', file: '/projects/README.md' }],
  ['links', { title: '友情链接', file: '/links/README.md' }],
]);
const directories = [
  { route: 'about', description: '关于我' },
  { route: 'projects', description: '项目' },
  { route: 'links', description: '友情链接' },
];
const aliases = new Map([
  ['home', ''],
  ['首页', ''],
  ['关于', 'about'],
  ['关于我', 'about'],
  ['项目', 'projects'],
  ['友链', 'links'],
  ['友情链接', 'links'],
  ['friends', 'links'],
]);
const commands = ['help', 'ls', 'cd', 'cat', 'pwd', 'whoami', 'history', 'back', 'clear'];
const promptClock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
const commandHistory = [];
let historyCursor = 0;
let currentRoute = routeFromLocation();

app.innerHTML = `
  <div class="terminal-shell">
    <header class="topbar">
      <div class="brand" aria-label="inxv terminal">
        <span class="brand-icon" aria-hidden="true">&gt;_</span>
        <span class="brand-name">inxv</span>
        <span class="brand-divider">/</span>
        <span class="brand-detail">terminal</span>
      </div>
    </header>

    <main id="terminal-screen" class="terminal-output" aria-label="终端">
      <div id="terminal-transcript" class="terminal-transcript" role="log" aria-live="polite" aria-label="终端输出"></div>

      <form id="command-form" class="command-form" autocomplete="off">
        <label class="prompt" for="command-input">
          <span id="prompt-time" class="prompt-time"></span>
          <span class="prompt-identity"><span class="prompt-user">guest</span><span class="prompt-at">@</span><span class="prompt-host">inxv</span></span>
          <span id="prompt-path" class="prompt-path">~</span>
        </label>
        <div class="command-line">
          <span class="prompt-symbol" aria-hidden="true">%</span>
          <input id="command-input" name="command" type="text" aria-label="输入终端命令" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="go" />
          <button class="submit-button" type="submit" aria-label="执行命令">↵</button>
        </div>
      </form>
    </main>
  </div>
`;

const terminal = document.querySelector('#terminal-screen');
const output = document.querySelector('#terminal-transcript');
const input = document.querySelector('#command-input');
const promptTime = document.querySelector('#prompt-time');
const promptPath = document.querySelector('#prompt-path');

if (!history.state?.inxv) {
  history.replaceState({ inxv: true, index: 0 }, '', location.href);
}

renderBoot(currentRoute !== '');
if (currentRoute) {
  appendCommand(`cd /${currentRoute}`, '');
  renderPage(currentRoute);
}
updateShell();

if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  input.focus({ preventScroll: true });
}

document.querySelector('#command-form').addEventListener('submit', (event) => {
  event.preventDefault();
  executeCommand(input.value);
  input.focus({ preventScroll: true });
});

app.addEventListener('click', (event) => {
  const button = event.target.closest('[data-command]');
  if (!button) return;

  executeCommand(button.dataset.command);
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    input.focus({ preventScroll: true });
  }
});

input.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowUp' && commandHistory.length) {
    event.preventDefault();
    historyCursor = Math.max(0, historyCursor - 1);
    input.value = commandHistory[historyCursor];
    input.setSelectionRange(input.value.length, input.value.length);
  } else if (event.key === 'ArrowDown' && commandHistory.length) {
    event.preventDefault();
    historyCursor = Math.min(commandHistory.length, historyCursor + 1);
    input.value = commandHistory[historyCursor] ?? '';
  } else if (event.key === 'Tab') {
    event.preventDefault();
    completeCommand();
  } else if (event.key === 'Escape') {
    input.value = '';
  }
});

window.addEventListener('popstate', () => {
  currentRoute = routeFromLocation();
  updateShell();
  appendNotice(`返回 ${displayPath(currentRoute)}`);
  renderPage(currentRoute);
  scrollToLatest();
});

function element(tag, className, text) {
  const created = document.createElement(tag);
  if (className) created.className = className;
  if (text !== undefined) created.textContent = text;
  return created;
}

function commandButton(label, command, className = 'inline-command') {
  const button = element('button', className, label);
  button.type = 'button';
  button.dataset.command = command;
  button.setAttribute('aria-label', `执行 ${command}`);
  return button;
}

function routeFromLocation() {
  if (!location.pathname.startsWith(baseUrl.pathname)) return '';
  const relative = decodeURIComponent(location.pathname.slice(baseUrl.pathname.length))
    .replace(/index\.html$/i, '')
    .replace(/^\/+|\/+$/g, '');
  return pages.has(relative) ? relative : '';
}

function routeUrl(route) {
  return new URL(route ? `${route}/` : './', baseUrl).pathname;
}

function displayPath(route) {
  return route ? `~/${route}` : '~';
}

function updateShell() {
  promptTime.textContent = promptClock.format(new Date());
  promptPath.textContent = displayPath(currentRoute);
  document.title = currentRoute ? `${pages.get(currentRoute).title} | inxv` : 'inxv | terminal';
}

function renderBoot(compact) {
  const block = element('section', compact ? 'boot boot-compact' : 'boot');
  if (compact) {
    block.append(element('p', 'compact-message', siteContent.tagline));
  } else {
    const title = element('h1', 'wordmark', siteContent.name);
    title.append(element('span', 'wordmark-cursor', '_'));
    block.append(title, element('p', 'hero-tagline', siteContent.tagline));
  }

  output.append(block);
}

function directoryListing() {
  const list = element('div', 'directory-list');
  for (const directory of directories) {
    const row = element('div', 'directory-row');
    row.append(commandButton(`${directory.route}/`, `cd ${directory.route}`, 'directory-command'));
    row.append(element('span', 'directory-description', directory.description));
    list.append(row);
  }
  return list;
}

function appendCommand(command, route) {
  const line = element('div', 'command-echo');
  const prompt = element('div', 'echo-prompt');
  prompt.append(element('span', 'prompt-time', promptClock.format(new Date())));
  prompt.append(' ');
  prompt.append(element('span', 'prompt-user', 'guest'));
  prompt.append(element('span', 'prompt-at', '@'));
  prompt.append(element('span', 'prompt-host', 'inxv'));
  prompt.append(' ');
  prompt.append(element('span', 'prompt-path', displayPath(route)));
  const echoLine = element('div', 'echo-line');
  echoLine.append(element('span', 'prompt-symbol', '%'), element('span', 'echo-command', command));
  line.append(prompt, echoLine);
  output.append(line);
}

function appendNotice(message, error = false) {
  const line = element('p', error ? 'notice notice-error' : 'notice', message);
  output.append(line);
}

function renderPage(route) {
  const page = pages.get(route);
  const block = element('section', 'response page-response');
  const meta = element('div', 'response-meta');
  meta.append(element('span', 'file-badge', 'FILE'));
  meta.append(element('span', 'file-path', page.file));
  block.append(meta, element('h2', 'page-title', page.title));

  if (route === '') {
    block.append(element('p', 'page-lead', '欢迎回到 inxv。所有页面都可以通过命令抵达。'));
    block.append(directoryListing());
  } else if (route === 'about') {
    for (const paragraph of siteContent.about) {
      block.append(element('p', 'page-paragraph', paragraph));
    }
    const details = element('div', 'detail-grid');
    details.append(detailRow('NAME', siteContent.name));
    details.append(detailRow('SITE', '个人终端'));
    details.append(detailRow('STATUS', '持续完善中'));
    block.append(details);
  } else if (route === 'projects') {
    block.append(element('p', 'page-lead', '这里收集我做过或正在做的项目。'));
    block.append(contentListing(siteContent.projects, '项目档案正在整理中。'));
  } else if (route === 'links') {
    block.append(element('p', 'page-lead', '一些值得访问的网站，会在这里相遇。'));
    block.append(contentListing(siteContent.links, '友情链接正在整理中。'));
  }

  const next = element('div', 'next-command');
  next.append(element('span', 'next-label', 'NEXT →'));
  next.append(commandButton(route ? 'cd ..' : 'ls', route ? 'cd ..' : 'ls'));
  next.append(element('span', 'next-explanation', route ? '返回首页' : '查看目录'));
  block.append(next);
  output.append(block);
}

function detailRow(label, value) {
  const row = element('div', 'detail-row');
  row.append(element('span', 'detail-key', label), element('span', 'detail-value', value));
  return row;
}

function contentListing(items, emptyMessage) {
  if (!items.length) {
    const empty = element('div', 'empty-state');
    empty.append(element('span', 'empty-symbol', '[ ··· ]'));
    empty.append(element('p', '', emptyMessage));
    return empty;
  }

  const list = element('div', 'content-list');
  for (const [index, item] of items.entries()) {
    const row = element('article', 'content-row');
    row.append(element('span', 'content-number', String(index + 1).padStart(2, '0')));
    const body = element('div', 'content-body');
    const safeUrl = externalUrl(item.url);
    const title = element(safeUrl ? 'a' : 'span', 'content-title', item.title);
    if (safeUrl) {
      title.href = safeUrl;
      title.target = '_blank';
      title.rel = 'noopener noreferrer';
    }
    body.append(title);
    if (item.description) body.append(element('p', 'content-description', item.description));
    row.append(body);
    if (safeUrl) row.append(element('span', 'content-arrow', '↗'));
    list.append(row);
  }
  return list;
}

function externalUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value, location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function renderHelp() {
  const block = element('section', 'response help-response');
  block.append(element('div', 'response-meta', '[ MANUAL / COMMANDS ]'));
  block.append(element('h2', 'page-title', '可用命令'));
  const rows = [
    ['help', '查看这份命令说明'],
    ['ls', '列出当前位置的内容'],
    ['cd <目录>', '进入页面；支持 /、.. 和中文栏目名'],
    ['cat README.md', '阅读当前页面'],
    ['pwd', '显示当前位置'],
    ['whoami', '查看当前访客身份'],
    ['history', '查看输入过的命令'],
    ['back', '返回上一条站内浏览记录'],
    ['clear', '清空终端输出'],
  ];
  const table = element('div', 'help-table');
  for (const [command, description] of rows) {
    const row = element('div', 'help-row');
    row.append(element('code', 'help-command', command));
    row.append(element('span', 'help-description', description));
    table.append(row);
  }
  block.append(table);
  const examples = element('p', 'help-examples');
  examples.append('试试 ');
  examples.append(commandButton('cd projects', 'cd projects'));
  examples.append(' 或 ');
  examples.append(commandButton('cd links', 'cd links'));
  examples.append('。');
  block.append(examples);
  output.append(block);
}

function renderListing() {
  const block = element('section', 'response listing-response');
  block.append(element('div', 'response-meta', `[ DIRECTORY /${currentRoute ? `${currentRoute}/` : ''} ]`));
  if (currentRoute) {
    const list = element('div', 'directory-list');
    const parent = element('div', 'directory-row');
    parent.append(commandButton('../', 'cd ..', 'directory-command'));
    parent.append(element('span', 'directory-description', '上一级'));
    list.append(parent);
    const file = element('div', 'directory-row');
    file.append(commandButton('README.md', 'cat README.md', 'directory-command directory-file'));
    file.append(element('span', 'directory-description', pages.get(currentRoute).title));
    list.append(file);
    block.append(list);
  } else {
    block.append(directoryListing());
  }
  output.append(block);
}

function renderHistory() {
  const block = element('section', 'response history-response');
  block.append(element('div', 'response-meta', '[ SESSION / HISTORY ]'));
  for (const [index, command] of commandHistory.entries()) {
    const row = element('div', 'history-row');
    row.append(element('span', 'history-number', String(index + 1).padStart(2, '0')));
    row.append(element('span', '', command));
    block.append(row);
  }
  output.append(block);
}

function resolveRoute(argument) {
  let target = argument.trim().toLowerCase();
  if (!target || target === '/' || target === '~') return '';
  if (target === '.' || target === './') return currentRoute;
  if (target === '..' || target === '../') return '';

  target = target.replace(/^(~\/|\.\.\/|\.\/|\/)/, '').replace(/\/+$/, '');
  target = aliases.get(target) ?? target;
  return pages.has(target) ? target : null;
}

function executeCommand(raw) {
  const line = raw.trim();
  if (!line) return;

  appendCommand(line, currentRoute);
  commandHistory.push(line);
  historyCursor = commandHistory.length;
  input.value = '';

  const [command, ...argumentsList] = line.split(/\s+/);
  const argument = argumentsList.join(' ');

  switch (command.toLowerCase()) {
    case 'help':
    case '?':
      renderHelp();
      break;
    case 'ls':
      renderListing();
      break;
    case 'cd': {
      const destination = resolveRoute(argument);
      if (destination === null) {
        appendNotice(`cd: 找不到目录 ${argument}。输入 ls 查看可用目录。`, true);
      } else if (destination === currentRoute) {
        appendNotice(`已经在 ${displayPath(currentRoute)}。`);
      } else {
        history.pushState({ inxv: true, index: (history.state?.index ?? 0) + 1 }, '', routeUrl(destination));
        currentRoute = destination;
        updateShell();
        renderPage(destination);
      }
      break;
    }
    case 'cat':
      if (!argument || ['README.md', './README.md'].includes(argument)) {
        renderPage(currentRoute);
      } else {
        appendNotice(`cat: 找不到文件 ${argument}。试试 cat README.md。`, true);
      }
      break;
    case 'pwd':
      appendNotice(currentRoute ? `/${currentRoute}` : '/');
      break;
    case 'whoami':
      appendNotice('guest: 欢迎来到 inxv。');
      break;
    case 'history':
      renderHistory();
      break;
    case 'back':
      if (history.state?.inxv && history.state.index > 0) {
        history.back();
      } else {
        appendNotice('没有可返回的站内记录。试试 cd ..。', true);
      }
      break;
    case 'clear':
      output.replaceChildren();
      break;
    default:
      appendNotice(`${command}: 未知命令。输入 help 查看可用命令。`, true);
  }

  promptTime.textContent = promptClock.format(new Date());
  scrollToLatest();
}

function completeCommand() {
  const value = input.value.toLowerCase();
  const candidates = value.startsWith('cd ')
    ? ['cd about', 'cd projects', 'cd links', 'cd ..', 'cd /', 'cd ~']
    : value.startsWith('cat ')
      ? ['cat README.md']
      : commands;
  const matches = candidates.filter((candidate) => candidate.toLowerCase().startsWith(value));

  if (value === 'cd' || value === 'cat') {
    input.value = `${value} `;
  } else if (matches.length === 1) {
    input.value = matches[0];
  } else if (matches.length > 1) {
    const prefix = matches.reduce((shared, candidate) => {
      let length = 0;
      while (length < shared.length && shared[length] === candidate[length]) length += 1;
      return shared.slice(0, length);
    });
    if (prefix.length > value.length) {
      input.value = prefix;
    } else {
      appendNotice(matches.join('    '));
      scrollToLatest();
    }
  }
}

function scrollToLatest() {
  requestAnimationFrame(() => {
    terminal.scrollTop = terminal.scrollHeight;
  });
}
