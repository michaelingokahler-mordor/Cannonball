import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession, SAVE_KEY } from '../src/session.ts';
import { enterService, updateRun } from '../src/simulation.ts';
import { BRANCH, SERVICES, TIME_SCALE, getVehicle } from '../src/data.ts';
import { isDrivable } from '../src/layout.ts';
import { nextRoadBend } from '../src/road.ts';
import { driveTraffic } from './helpers/driver.ts';

async function presets(){const result=await import('../src/test-scenarios.ts').catch(()=>null);assert.ok(result,'deliberate test presets must be available');return result;}
function storage(){const data=new Map<string,string>();let writes=0;return {data,get writes(){return writes;},getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{writes++;data.set(k,v);}};}

test('five deliberate scenarios preserve the chosen car and crew with deterministic valid starting states',async()=>{
  const {TEST_SCENARIOS,createTestRun}=await presets();
  assert.deepEqual(TEST_SCENARIOS.map(s=>s.id),['traffic','police','fork','curves','service']);
  for(const {id,name,description} of TEST_SCENARIOS){
    assert.ok(name&&description);
    const options={vehicleId:'hohenfels',crew:['helen','lou'] as [string,string]};
    const state=createTestRun(id,options);
    assert.deepEqual(state,createTestRun(id,options));assert.equal(state.vehicleId,'hohenfels');assert.deepEqual(state.crew,options.crew);
    assert.equal(state.status,'driving');assert.equal(state.route,'main');assert.equal(state.routeChoice,'main');
    assert.ok(isDrivable(state.distance,state.x,state.route));assert.ok(state.speed<=getVehicle(state.vehicleId).gearSpeeds[state.gear-1]);
    assert.ok(state.fuel>0&&state.condition>0&&state.tires>0);assert.ok(Number.isFinite(state.elapsed)&&Number.isFinite(state.drivingTime));
    assert.equal(state.countyIndex,state.counties.findIndex(c=>state.distance<c.end));
    assert.ok(state.counties.every(c=>!c.police||c.police.trigger>=state.distance||c.police.resolved));
    assert.ok(state.log.some(entry=>/Testfahrt/.test(entry.text)),'setup must identify itself instead of pretending it was driven');
  }
});

test('scenario starts put the relevant physical road context close by',async()=>{
  const {createTestRun}=await presets();
  const traffic=createTestRun('traffic');assert.equal(traffic.distance,0);assert.equal(traffic.speed,0);
  assert.ok(traffic.traffic.some(c=>c.body==='truck'&&c.distance<traffic.distance&&!c.oncoming));
  assert.ok(traffic.traffic.some(c=>c.role==='rival'&&c.distance<traffic.distance));
  const fork=createTestRun('fork');assert.ok(Math.abs(fork.distance-(BRANCH.start-1200))<10);
  assert.ok(fork.rivals.filter(r=>r.distance>=100000).every(r=>r.stopUntil<=fork.elapsed),'a prepared fork scene must not invent a fresh pit stop for a marker the team had already passed');
  const curves=createTestRun('curves');assert.ok(Math.abs(curves.distance-(nextRoadBend(9000)!.start-1000))<10);
  const service=createTestRun('service');assert.ok(Math.abs(service.distance-(SERVICES[0].distance-3000))<10);
});

test('police test starts with a physical officer ahead and normal inputs can trigger and surrender',async()=>{
  const {createTestRun}=await presets();const state=createTestRun('police');
  const officer=state.traffic.find(c=>c.role==='police')!;assert.ok(officer);assert.ok(officer.distance>state.distance);
  assert.equal(state.police.mode,'watching');assert.ok(state.comment&&/Polizei|Streife/.test(state.comment.text));
  let detected=false;
  for(let i=0;i<60*45&&state.violations===0;i++){
    const input=detected?{throttle:0,brake:1,steer:Math.max(-1,Math.min(1,(1.5-state.x)*12))}:driveTraffic(state,160);
    updateRun(state,input,1/60);detected ||= state.police.mode==='pursuit';
  }
  assert.equal(detected,true);assert.equal(state.violations,1);assert.equal(state.traffic.find(c=>c.role==='police')?.id,officer.id);
  assert.match(state.comment?.text??'',/Strafzettel bezahlt/,'the completed ticket must immediately replace the chase instruction');
});

test('the service preset reaches the automatic parking menu using ordinary steering and braking',async()=>{
  const {createTestRun}=await presets();const state=createTestRun('service');
  for(let i=0;i<60*60&&state.status==='driving';i++){
    const remaining=Math.max(0,SERVICES[0].distance-180-state.distance);
    const target=Math.min(70,Math.sqrt(2*40*3.6*remaining/TIME_SCALE));
    const input=driveTraffic(state,target);
    if(state.distance>SERVICES[0].distance-2300)input.steer=Math.max(-1,Math.min(1,(1.75-state.x)*12));
    updateRun(state,input,1/60);
  }
  assert.equal(state.status,'service');assert.equal(state.serviceId,SERVICES[0].id);
});

test('test sessions cannot overwrite an existing saved normal journey and only successful normal start or load clears the flag',()=>{
  const store=storage(),normal=new GameSession(store);normal.start({seed:42});
  normal.state!.distance=SERVICES[0].distance;normal.state!.x=1.75;normal.state!.speed=0;enterService(normal.state!);assert.equal(normal.save().ok,true);
  const saved=store.data.get(SAVE_KEY)!,writes=store.writes,session=new GameSession(store);
  assert.equal(typeof session.startTest,'function','the session must explicitly distinguish test setup from a normal journey');
  session.startTest('service');assert.equal(session.testScenario,'service');
  session.state!.distance=SERVICES[0].distance;session.state!.x=1.75;session.state!.speed=0;enterService(session.state!);
  assert.equal(session.save().ok,false);assert.equal(store.data.get(SAVE_KEY),saved);assert.equal(store.writes,writes);
  assert.throws(()=>session.start({vehicleId:'unknown'}));assert.equal(session.testScenario,'service');
  store.data.set(SAVE_KEY,'invalid');assert.equal(session.load().ok,false);assert.equal(session.testScenario,'service');
  store.data.set(SAVE_KEY,saved);assert.equal(session.load().ok,true);assert.equal(session.testScenario,null);
  session.startTest('traffic');session.start({seed:42});assert.equal(session.testScenario,null);
});
