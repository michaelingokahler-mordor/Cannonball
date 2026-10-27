import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,enterService,restoreRun,serializeRun,serviceAction} from '../src/simulation.ts';

function parked(){const state=createRun({seed:42});state.distance=45000;state.x=1.75;assert.ok(enterService(state));return state;}

test('actor sound and rival police penalties survive an exact safe service round trip',()=>{
  const state=parked();state.rivals[0].violations=1;state.rivals[0].policeStopUntil=480;
  state.traffic[0].hornUntil=.2;state.traffic[0].siren=false;
  const raw=serializeRun(state);assert.ok(raw);assert.deepEqual(restoreRun(raw),state);
});

test('malformed optional actor and rival fields are rejected before reaching sound or simulation',()=>{
  const raw=serializeRun(parked())!;
  for(const mutate of [
    (s:any)=>{s.traffic[0].hornUntil=-1;},(s:any)=>{s.traffic[0].hornUntil=1e99;},
    (s:any)=>{s.traffic[0].siren='yes';},(s:any)=>{s.rivals[0].violations=-1;},
    (s:any)=>{s.rivals[0].policeStopUntil='480';},
  ]){const value=JSON.parse(raw);mutate(value);assert.ok(restoreRun(JSON.stringify(value))===null,'Malformed optional field was accepted');}
});

test('service time skips honor a rival police hold instead of advancing that team at race pace',()=>{
  const state=parked(),held=state.rivals[0],free=state.rivals[1];
  held.policeStopUntil=state.elapsed+480;
  const before=held.distance,freeBefore=free.distance;
  assert.ok(serviceAction(state,'refuel').ok);
  assert.equal(held.distance,before);assert.ok(free.distance>freeBefore);
});
