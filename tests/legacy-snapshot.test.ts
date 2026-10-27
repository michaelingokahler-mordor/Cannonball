import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {restoreRun} from '../src/simulation.ts';

const legacyRaw=readFileSync(new URL('./fixtures/service-v1.json',import.meta.url),'utf8');
test('the actual v1 release service snapshot migrates onto its real parking bay without losing progress',()=>{
  const old=JSON.parse(legacyRaw),next=restoreRun(legacyRaw);
  assert.ok(next,'Existing release save must load');
  assert.equal(next.version,2);assert.equal(next.x,1.75);assert.equal(next.status,'service');
  for(const key of ['vehicleId','crew','activeDriver','fuel','condition','tires','fatigue','elapsed','drivingTime','rng','seed','confirmedEvents','timePenalties','serviced'] as const){
    assert.deepEqual(next[key],old[key],`Migration changed ${key}`);
  }
  assert.equal(next.escapes,0);
  assert.deepEqual(next.counties.map(c=>c.police?.id??null),old.counties.map((c:any)=>c.police?.id??null));
});
test('legacy remote service position is relocated to that same facility rather than rejected or healed',()=>{
  const old=JSON.parse(legacyRaw);old.distance=46200;
  const next=restoreRun(JSON.stringify(old));assert.ok(next);
  assert.equal(next.distance,45000);assert.equal(next.x,1.75);assert.equal(next.serviceId,'sundown');
  assert.equal(next.fuel,old.fuel);assert.deepEqual(next.fatigue,old.fatigue);assert.equal(next.elapsed,old.elapsed);
});
