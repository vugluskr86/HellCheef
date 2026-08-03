import assert from 'node:assert/strict';
import test from 'node:test';

import { TUTORIAL_CONFIG, advanceTutorial, createTutorialState, currentTutorialStep } from './tutorial.ts';

test('tutorial config has ordered steps and can be disabled', () => {
  const state = createTutorialState({
    ...TUTORIAL_CONFIG,
    enabledByDefault: true,
  });

  assert.equal(state.enabled, true);
  assert.ok(state.steps.length >= 3, 'должна быть последовательность шагов');
  assert.equal(currentTutorialStep(state, { mode: 'start' } as any)?.id, 'intro');

  state.enabled = false;
  assert.equal(currentTutorialStep(state, { mode: 'world' } as any), null);
});

test('tutorial advances by game state and preserves config contract', () => {
  const state = createTutorialState(TUTORIAL_CONFIG);
  const game = {
    mode: 'start',
    orders: [],
    player: { x: 13, y: 13 },
    level: { kind: 'hub' },
    station: null,
    depth: 0,
    turn: 1,
    cook: null,
    tutorial: state,
  } as any;

  const intro = currentTutorialStep(state, game);
  assert.equal(intro?.id, 'intro');

  const classStep = advanceTutorial(state, game);
  assert.ok(classStep, 'должен возвращать шаг выбора класса');
  assert.equal(classStep!.id, 'class');

  const orderStep = advanceTutorial(state, game);
  assert.ok(orderStep, 'должен возвращать следующий шаг после перехода');
  assert.equal(orderStep!.id, 'order');

  game.mode = 'world';
  game.orders = [{ id: 1, state: 'active' }];
  const manualStep = currentTutorialStep(state, game);
  assert.equal(manualStep?.id, 'order');
  assert.equal(TUTORIAL_CONFIG.steps[0].id, 'intro');
});
