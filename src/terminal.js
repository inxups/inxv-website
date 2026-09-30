import projects from '../assets/projects.generated.json' with { type: 'json' };

export { projects };

export function projectRoute(project) {
  return `projects/${project.title}`;
}

export const pages = new Map([
  ['', { title: '首页', file: '/README.md', description: 'inxv 的个人终端。通过命令或目录探索项目、友情链接和关于我。' }],
  ['about', { title: '关于我', file: '/about/README.md', description: '关于 inxv。' }],
  ['projects', { title: '项目', file: '/projects/README.md', description: 'inxv 的项目。' }],
  ['links', { title: '友情链接', file: '/links/README.md', description: 'inxv 的友情链接。' }],
  ...projects.map((project) => [projectRoute(project), {
    title: project.title,
    file: `/${projectRoute(project)}/README.md`,
    description: project.description || `${project.title} 项目。`,
    project,
  }]),
]);

export const directories = [
  { route: 'about', description: '关于我' },
  { route: 'projects', description: '项目' },
  { route: 'links', description: '友情链接' },
];

export const helpRows = [
  ['help', '查看这份命令说明'],
  ['ls', '列出当前位置的内容'],
  ['cd <目录>', '进入页面；支持 /、.. 和中文栏目名'],
  ['cat README.md', '阅读当前页面'],
  ['clear', '清空终端输出'],
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

const commands = ['help', 'ls', 'cd', 'cat', 'clear'];
const promptClock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

export function promptTime(date = new Date()) {
  return promptClock.format(date);
}

export function displayPath(route) {
  return route ? `~/${route}` : '~';
}

export function routeFromLocation(pathname, basePath) {
  if (!pathname.startsWith(basePath)) return '';

  try {
    const relative = decodeURIComponent(pathname.slice(basePath.length))
      .replace(/index\.html$/i, '')
      .replace(/^\/+|\/+$/g, '');
    return canonicalRoute(relative) ?? '';
  } catch {
    return '';
  }
}

export function routeUrl(route, baseUrl) {
  return new URL(route ? `${route.split('/').map(encodeURIComponent).join('/')}/` : './', baseUrl).pathname;
}

function canonicalRoute(route) {
  return [...pages.keys()].find((candidate) => candidate.toLowerCase() === route.toLowerCase()) ?? null;
}

export function resolveRoute(argument, currentRoute) {
  let target = argument.trim();
  if (!target || target === '/' || target === '~') return '';
  if (target === '.' || target === './') return currentRoute;
  const absolute = /^(~\/|\/)/.test(target);
  target = target.replace(/^(~\/|\/)/, '').replace(/\/+$/, '');
  const alias = aliases.get(target.toLowerCase());
  if (alias !== undefined) return alias;
  if (!target.startsWith('.') && canonicalRoute(target) !== null) return canonicalRoute(target);
  const segments = absolute ? [] : currentRoute.split('/').filter(Boolean);
  for (const segment of target.split('/')) {
    if (segment === '..') segments.pop();
    else if (segment && segment !== '.') segments.push(segment);
  }
  return canonicalRoute(segments.join('/'));
}

function notice(message, error = false) {
  return { type: 'notice', message, error };
}

export function interpretCommand(line, route) {
  const [command, ...argumentsList] = line.split(/\s+/);
  const argument = argumentsList.join(' ');

  switch (command.toLowerCase()) {
    case 'help':
      return { response: { type: 'help' } };
    case 'ls':
      return { response: { type: 'listing', route } };
    case 'cd': {
      const destination = resolveRoute(argument, route);
      if (destination === null) {
        return { response: notice(`cd: 找不到目录 ${argument}。输入 ls 查看可用目录。`, true) };
      }
      if (destination === route) {
        return { response: notice(`已经在 ${displayPath(route)}。`) };
      }
      return { response: { type: 'page', route: destination }, destination };
    }
    case 'cat':
      return !argument || ['README.md', './README.md'].includes(argument)
        ? { response: { type: 'page', route } }
        : { response: notice(`cat: 找不到文件 ${argument}。试试 cat README.md。`, true) };
    case 'clear':
      return { clear: true };
    default:
      return { response: notice(`${command}: 未知命令。输入 help 查看可用命令。`, true) };
  }
}

export function createInitialState(route, time) {
  const showProject = Boolean(pages.get(route)?.project);
  return {
    route,
    blocks: showProject ? [{ id: 0, echo: null, response: { type: 'page', route } }] : [],
    commandHistory: [],
    historyCursor: 0,
    draft: '',
    promptTime: time,
    nextId: showProject ? 1 : 0,
    scrollVersion: 0,
  };
}

export function applyCommand(state, line, time) {
  const commandHistory = [...state.commandHistory, line];
  const result = interpretCommand(line, state.route);
  const block = {
    id: state.nextId,
    echo: { command: line, route: state.route, time },
    response: result.response ?? null,
  };

  return {
    state: {
      ...state,
      route: result.destination ?? state.route,
      blocks: result.clear ? [] : [...state.blocks, block],
      commandHistory,
      historyCursor: commandHistory.length,
      draft: '',
      promptTime: time,
      nextId: state.nextId + 1,
      scrollVersion: state.scrollVersion + 1,
    },
    effect: result.destination !== undefined
      ? { type: 'push', route: result.destination }
      : null,
  };
}

export function applyPopState(state, route, time) {
  const response = { type: 'page', route, notice: `返回 ${displayPath(route)}` };

  return {
    ...state,
    route,
    blocks: [...state.blocks, { id: state.nextId, echo: null, response }],
    promptTime: time,
    nextId: state.nextId + 1,
    scrollVersion: state.scrollVersion + 1,
  };
}

export function stepHistory(state, direction) {
  const historyCursor = direction === 'up'
    ? Math.max(0, state.historyCursor - 1)
    : Math.min(state.commandHistory.length, state.historyCursor + 1);

  return {
    ...state,
    historyCursor,
    draft: state.commandHistory[historyCursor] ?? '',
  };
}

export function completeInput(raw, route = '') {
  const value = raw.toLowerCase();
  const candidates = value.startsWith('cd ')
    ? ['cd about', 'cd projects', 'cd links', 'cd ..', 'cd /', 'cd ~',
      ...projects.map((project) => `cd ${route === 'projects' ? project.title : projectRoute(project)}`)]
    : value.startsWith('cat ')
      ? ['cat README.md']
      : commands;
  const matches = candidates.filter((candidate) => candidate.toLowerCase().startsWith(value));

  if (value === 'cd' || value === 'cat') return { value: `${value} ` };
  if (matches.length === 1) return { value: matches[0] };
  if (matches.length > 1) {
    const prefix = matches.reduce((shared, candidate) => {
      let length = 0;
      while (length < shared.length && shared[length] === candidate[length]) length += 1;
      return shared.slice(0, length);
    });
    if (prefix.length > value.length) return { value: prefix };
    return { value: raw, suggestions: matches.join('    ') };
  }
  return { value: raw };
}

export function applyCompletion(state) {
  const { value, suggestions } = completeInput(state.draft, state.route);
  if (!suggestions) return value === state.draft ? state : { ...state, draft: value };

  const lastResponse = state.blocks.at(-1)?.response;
  if (lastResponse?.type === 'completion' && lastResponse.message === suggestions) return state;

  return {
    ...state,
    blocks: [...state.blocks, {
      id: state.nextId,
      echo: null,
      response: { type: 'completion', message: suggestions },
    }],
    nextId: state.nextId + 1,
    scrollVersion: state.scrollVersion + 1,
  };
}
