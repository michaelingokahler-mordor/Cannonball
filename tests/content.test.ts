import test from 'node:test';
import assert from 'node:assert/strict';
import { BRANCH, CREW, ROUTE_STATES, SERVICES, STAGE_LENGTH, TIME_SCALE, VEHICLES, getCrew, getVehicle } from '../src/data.ts';
import { generateCounties, getRoadSample, seededRandom } from '../src/road.ts';

test('County outcomes persist as a reproducible seed plan with zero or one event per county',()=>{
  const plan=generateCounties(42);
  assert.equal(plan.length,6);
  assert.deepEqual(plan,generateCounties(42));
  assert.notDeepEqual(plan,generateCounties(9321));
  assert.equal(plan[0].start,0); assert.equal(plan.at(-1)!.end,360000);
  assert.ok(plan.some(c=>c.police===null)); assert.ok(plan.some(c=>c.police!==null));
  for(let i=0;i<plan.length;i++){
    const c=plan[i]; if(i)assert.equal(c.start,plan[i-1].end);
    if(c.police){assert.ok(c.police.trigger>c.start&&c.police.trigger<c.end);assert.equal(c.police.activated,false);}
  }
});
test('random generator is reproducible, finite and never returns one',()=>{
  const a=seededRandom(0),b=seededRandom(0);
  const xs=Array.from({length:100},()=>a());
  assert.deepEqual(xs,Array.from({length:100},()=>b()));
  assert.ok(xs.every(x=>x>=0&&x<1)); assert.ok(new Set(xs).size>90);
});
test('playable car speeds cannot finish Pennsylvania in less than ten real driving minutes',()=>{
  const playable=VEHICLES.filter(v=>v.prototype);
  assert.equal(playable.length,2);
  for(const v of playable){assert.ok(STAGE_LENGTH/(v.maxSpeed/3.6*TIME_SCALE)>=600);}
  assert.equal(getVehicle('steinbach').transmission,'manual');
  assert.equal(getVehicle('hohenfels').transmission,'automatic');
});
test('crew pairs share mechanical archetype values and two different characters can be selected',()=>{
  assert.equal(CREW.length,12);
  for(const type of new Set(CREW.map(c=>c.archetype))){
    const pair=CREW.filter(c=>c.archetype===type); assert.equal(pair.length,2);
    assert.deepEqual(new Set(pair.map(c=>c.gender)),new Set(['m','f']));
    for(const field of ['fatigue','fuel','acceleration','handling','repair','navigation','stress'] as const)assert.equal(pair[0][field],pair[1][field]);
  }
  assert.notEqual(getCrew('jack').id,getCrew('rose').id);
});
test('route catalog clearly limits availability to the actual sample and families do not point outside the roster',()=>{
  assert.equal(ROUTE_STATES.length,13); assert.deepEqual(ROUTE_STATES.filter(s=>s.available).map(s=>s.id),['pa']);
  assert.equal(VEHICLES.length,10);
  for(const v of VEHICLES)if(v.unlockAfter)assert.ok(VEHICLES.some(parent=>parent.id===v.unlockAfter));
});
test('road samples vary through the stage and stay finite in front and rear projections',()=>{
  const themes=new Set<string>();
  for(let d=-12000;d<STAGE_LENGTH+12000;d+=271){
    const s=getRoadSample(d); assert.ok(Number.isFinite(s.height)&&Number.isFinite(s.curve));
    assert.ok(Math.abs(s.curve)<=1); themes.add(s.theme);
  }
  assert.ok(themes.size>=5);
  assert.ok(SERVICES.some(s=>s.kind==='diner'));
  assert.ok(SERVICES.every(s=>s.distance>0&&s.distance<STAGE_LENGTH));
  assert.ok(getRoadSample((BRANCH.decision+BRANCH.end)/2,'detour').rough);
});
