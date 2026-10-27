import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CREW } from '../src/data.ts';
import { createRun, updateRun } from '../src/simulation.ts';
import { canReplaceComment, getNavigationCues, makePassengerComment, nextNavigationCue } from '../src/comments.ts';
const idle = { throttle: 0, brake: 0, steer: 0 };
const person = (id: string) => CREW.find(person => person.id === id)!;

test('service guidance only recommends stops physically reachable from the selected route', () => {
  const state=createRun();state.distance=113000;
  const main=getNavigationCues(state,person('rose'));
  assert.ok(main.some(cue=>cue.id==='service-hint:miller'));
  state.route='detour';
  assert.equal(getNavigationCues(state,person('rose')).some(cue=>cue.kind==='service'),false);
  state.distance=183000;state.route='main';
  assert.ok(getNavigationCues(state,person('rose')).some(cue=>cue.id==='service-hint:bluebird'));
});

test('a lower town limit is announced before the boundary with the braking action intact', () => {
  const state = createRun({ crew: ['jack', 'rose'] });
  state.distance = 72000;
  updateRun(state, idle, 1 / 60);
  assert.ok(state.comment?.text.includes('35 mph'));
  assert.ok(state.comment?.text.includes('abbremsen'));
  assert.ok(state.distance < 75000);
});

test('navigation timing comes from the passenger, including after swapping their roles', () => {
  const navigatorPassenger = createRun({ crew: ['jack', 'rose'] });
  const ordinaryPassenger = createRun({ crew: ['jack', 'hank'] });
  const navigatorDriver = createRun({ crew: ['rose', 'hank'] });
  for (const state of [navigatorPassenger, ordinaryPassenger, navigatorDriver]) state.distance = 71000;
  updateRun(navigatorPassenger, idle, 1 / 60);
  updateRun(ordinaryPassenger, idle, 1 / 60);
  updateRun(navigatorDriver, idle, 1 / 60);
  assert.ok(navigatorPassenger.triggered.includes('speed-hint:75000'));
  assert.equal(ordinaryPassenger.triggered.includes('speed-hint:75000'), false);
  assert.equal(navigatorDriver.triggered.includes('speed-hint:75000'), false);
});

test('archetypes phrase the same action differently while paired characters share a tone', () => {
  const text = 'Ort voraus: auf 35 mph (56 km/h) abbremsen.';
  const navigator = makePassengerComment(person('rose'), text, 5, 2);
  const mechanic = makePassengerComment(person('eddie'), text, 5, 2);
  const maleNavigator = makePassengerComment(person('miles'), text, 5, 2);
  assert.notEqual(navigator.text, mechanic.text);
  assert.equal(navigator.text, maleNavigator.text);
  assert.notEqual(navigator.speaker, maleNavigator.speaker);
  assert.ok(navigator.text.includes(text));
  assert.ok(mechanic.text.includes(text));
  assert.ok(navigator.text.length <= 69);
});

test('police and resource warnings win over navigation without consuming a blocked cue', () => {
  for (const priority of [3, 4]) {
    const state = createRun(); state.distance = 72000;
    state.comment = { text: 'Polizei: Abstand gewinnen oder anhalten.', speaker: 'Rose Carter', until: 20, priority };
    const before = structuredClone(state.comment);
    updateRun(state, idle, 1 / 60);
    assert.deepEqual(state.comment, before);
    assert.equal(state.triggered.includes('speed-hint:75000'), false);
    assert.equal(canReplaceComment(before, 1, 2), false);
  }
});

test('a curve cue is sampled ahead, emitted only once per road segment and does not reroll state', () => {
  const state = createRun(); state.distance = 9000;
  const before = structuredClone(state);
  const cues = getNavigationCues(state, person('rose'));
  const curve = cues.find(cue => cue.kind === 'curve');
  assert.ok(curve);
  assert.ok(curve.text.includes('Kurve'));
  assert.ok(curve.text.includes('Spur halten'));
  assert.deepEqual(state, before);
  updateRun(state, idle, 1 / 60);
  assert.equal(state.triggered.filter(id => id === curve.id).length, 1);
  const commentUntil = state.comment!.until;
  updateRun(state, idle, 1);
  assert.equal(state.triggered.filter(id => id === curve.id).length, 1);
  assert.equal(state.comment!.until, commentUntil);
  state.comment = null;
  assert.equal(nextNavigationCue(state, person('rose')), null);
});

test('Pennsylvania has distinct Susquehanna and Allegheny landscape cues plus a named scenic point', () => {
  const state = createRun();
  const texts = [132000, 194000, 242000].map(distance => {
    state.distance = distance;
    return getNavigationCues(state, person('rose')).find(cue => cue.kind === 'landmark')?.text ?? '';
  });
  assert.match(texts[0], /Susquehanna/);
  assert.match(texts[1], /Keystone Lookout/);
  assert.match(texts[1], /Aussichtspunkt/);
  assert.match(texts[2], /Allegheny/);
});

test('all new barks fit the comment panel without cutting off their action', () => {
  const state = createRun();
  for (const passenger of CREW) {
    for (const distance of [11000, 43000, 72000, 88000, 114000, 132000, 183000, 194000, 242000, 253000, 272000, 313000]) {
      state.distance = distance;
      for (const cue of getNavigationCues(state, passenger)) {
        const comment = makePassengerComment(passenger, cue.text, 0, cue.priority);
        assert.ok(comment.text.length <= 69, `${passenger.id}: ${comment.text}`);
      }
    }
  }
});

test('the pursuit instruction fits the panel and keeps both escape and yielding actions', () => {
  const state = createRun({ seed: 42 });
  state.distance = state.counties[0].police!.trigger - 1; state.speed = 220; state.gear = 4;
  updateRun(state, { throttle: 1, brake: 0, steer: 0 }, 1 / 60);
  assert.equal(state.police.mode, 'pursuit');
  assert.ok(state.comment!.text.length <= 69, state.comment!.text);
  assert.match(state.comment!.text, /Abstand gewinnen/);
  assert.match(state.comment!.text, /anhalten/);
});
