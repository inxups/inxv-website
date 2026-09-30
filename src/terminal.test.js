import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyCommand,
  applyCompletion,
  applyPopState,
  createInitialState,
  routeFromLocation,
  routeUrl,
  stepHistory,
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
  const navigation = applyCommand(state, 'cd 关于我', '10:01', false);
  assert.deepEqual(navigation.effect, { type: 'push', route: 'about' });
  state = navigation.state;
  assert.equal(state.route, 'about');
  assert.equal(state.blocks.at(-1).response.route, 'about');

  state = applyCommand(state, 'history', '10:02', true).state;
  assert.deepEqual(state.blocks.at(-1).response.commands, ['cd 关于我', 'history']);
  state = stepHistory(state, 'up');
  assert.equal(state.draft, 'history');
  state = stepHistory(state, 'up');
  assert.equal(state.draft, 'cd 关于我');
  state = stepHistory(state, 'down');
  assert.equal(state.draft, 'history');
});

test('back fills its command block after the browser changes location', () => {
  let state = createInitialState('about', '10:00');
  state = applyCommand(state, 'back', '10:01', true).state;
  assert.equal(state.blocks.at(-1).response, null);

  state = applyPopState(state, '', '10:02');
  assert.equal(state.route, '');
  assert.equal(state.blocks.length, 2);
  assert.equal(state.blocks.at(-1).response.notice, '返回 ~');
});

test('clear removes output while retaining command history and current route', () => {
  let state = createInitialState('projects', '10:00');
  state = applyCommand(state, 'clear', '10:01', false).state;
  assert.equal(state.blocks.length, 0);
  assert.equal(state.route, 'projects');
  assert.deepEqual(state.commandHistory, ['clear']);
});

test('Tab completion expands a command and does not repeat identical suggestions', () => {
  let state = createInitialState('', '10:00');
  state = applyCompletion({ ...state, draft: 'cd' });
  assert.equal(state.draft, 'cd ');
  state = applyCompletion(state);
  assert.equal(state.blocks.at(-1).response.type, 'completion');
  assert.equal(applyCompletion(state), state);
});
