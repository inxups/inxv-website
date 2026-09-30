import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyCommand,
  applyCompletion,
  completeInput,
  createInitialState,
  routeFromLocation,
  routeUrl,
  stepHistory,
  projects,
  projectRoute,
  resolveRoute,
} from './terminal.js';

test('direct routes and generated URLs work under a deployment subpath', () => {
  const base = new URL('https://example.com/site/');
  assert.equal(routeFromLocation('/site/', base.pathname), '');
  assert.equal(routeFromLocation('/site/about/', base.pathname), 'about');
  assert.equal(routeFromLocation('/site/projects/index.html', base.pathname), 'projects');
  assert.equal(routeUrl('links', base), '/site/links/');
  assert.equal(routeUrl('', base), '/site/');
});

test('commands keep the transcript, route, and command history in sync', () => {
  let state = createInitialState('', '10:00');
  const navigation = applyCommand(state, 'cd 关于我', '10:01');
  assert.deepEqual(navigation.effect, { type: 'push', route: 'about' });
  state = navigation.state;
  assert.equal(state.route, 'about');
  assert.equal(state.blocks.at(-1).response.route, 'about');

  state = applyCommand(state, 'cat README.md', '10:02').state;
  assert.deepEqual(state.commandHistory, ['cd 关于我', 'cat README.md']);
  assert.deepEqual(state.blocks.at(-1).response, { type: 'page', route: 'about' });
  state = stepHistory(state, 'up');
  assert.equal(state.draft, 'cat README.md');
  state = stepHistory(state, 'up');
  assert.equal(state.draft, 'cd 关于我');
  state = stepHistory(state, 'down');
  assert.equal(state.draft, 'cat README.md');
});

test('removed commands return an error and do not navigate', () => {
  for (const command of ['pwd', 'whoami', 'history', 'back', '?']) {
    const { state, effect } = applyCommand(createInitialState('about', '10:00'), command, '10:01');
    assert.equal(state.route, 'about');
    assert.equal(effect, null);
    assert.deepEqual(state.blocks.at(-1).response, {
      type: 'notice',
      message: `${command}: 未知命令。输入 help 查看可用命令。`,
      error: true,
    });
    assert.deepEqual(completeInput(command), { value: command });
  }
});

test('clear removes output while retaining command history and current route', () => {
  let state = createInitialState('projects', '10:00');
  state = applyCommand(state, 'clear', '10:01').state;
  assert.equal(state.blocks.length, 0);
  assert.equal(state.route, 'projects');
  assert.deepEqual(state.commandHistory, ['clear']);
});

test('Tab completion expands a command and does not repeat identical suggestions', () => {
  assert.deepEqual(completeInput(''), { value: '', suggestions: 'help    ls    cd    cat    clear' });
  let state = createInitialState('', '10:00');
  state = applyCompletion({ ...state, draft: 'cd' });
  assert.equal(state.draft, 'cd ');
  state = applyCompletion(state);
  assert.equal(state.blocks.at(-1).response.type, 'completion');
  assert.equal(applyCompletion(state), state);
});

test('project commands resolve nested paths and return to their parent directory', () => {
  const project = projects[0];
  const route = projectRoute(project);
  assert.equal(resolveRoute(project.title, 'projects'), route);
  assert.equal(resolveRoute(`/${route}`, 'about'), route);
  assert.equal(resolveRoute(route.toUpperCase(), ''), route);
  assert.equal(resolveRoute('..', route), 'projects');
  assert.equal(resolveRoute('../..', route), '');
  assert.equal(resolveRoute('cd-does-not-exist', 'projects'), null);
  assert.equal(routeFromLocation(`/site/${route}/index.html`, '/site/'), route);
  assert.equal(routeUrl(route, new URL('https://example.com/site/')), `/site/${route}/`);
  assert.equal(completeInput(`cd ${project.title}`, 'projects').value, `cd ${project.title}`);
  let state = createInitialState(route, '10:00');
  assert.equal(state.blocks[0].response.route, route);
  const result = applyCommand(state, 'cd ..', '10:01');
  assert.equal(result.state.route, 'projects');
  assert.deepEqual(result.effect, { type: 'push', route: 'projects' });
  state = applyCommand(createInitialState('projects', '10:00'), `cd ${project.title}`, '10:01').state;
  assert.equal(state.route, route);
  assert.deepEqual(applyCommand(state, 'cat README.md', '10:02').state.blocks.at(-1).response, { type: 'page', route });
});
