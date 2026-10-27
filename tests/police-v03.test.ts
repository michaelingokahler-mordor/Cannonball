import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, serializeRun, shiftGear, updateRun } from '../src/simulation.ts';
import { SERVICES, TIME_SCALE } from '../src/data.ts';
import { driveTraffic } from './helpers/driver.ts';
import { GameAudio } from '../src/audio.ts';

const idle={throttle:0,brake:0,steer:0};

for(const [seed,stopX] of [[42,1.5],[1976,1.5],[42,1.75],[1976,1.75],[0,1.15],[25,1.15]])test(`natural right shoulder surrender reaches a stopped officer behind, seed ${seed}, x=${stopX}`,()=>{
  const state=createRun({seed});let detected=false,officerId='',lastOfficerDistance=-Infinity,stoppedAt:number|null=null,arrivedAt:number|null=null;
  for(let frame=0;frame<60*220&&state.status==='driving'&&state.violations===0;frame++){
    if(state.gear<4&&state.speed>[0,64,112,165][state.gear])shiftGear(state,1);
    const input=detected?{throttle:0,brake:1,steer:Math.max(-1,Math.min(1,(stopX-state.x)*12))}:driveTraffic(state,180);
    updateRun(state,input,1/60);
    const officer=state.traffic.find(car=>car.role==='police');
    if(officer){
      officerId ||= officer.id;assert.equal(officer.id,officerId);
      assert.ok(officer.distance>=lastOfficerDistance-1e-8,'officer may not reverse into the driver');lastOfficerDistance=officer.distance;
      assert.equal(officer.oncoming,false);
    }
    if(state.police.mode==='pursuit')detected=true;
    if(detected&&state.speed===0)stoppedAt??=state.drivingTime;
    if(officer&&stoppedAt!==null&&officer.speed<=10&&state.distance-officer.distance>=50&&state.distance-officer.distance<=70)arrivedAt??=state.drivingTime;
  }
  const officer=state.traffic.find(car=>car.id===officerId)!;
  assert.equal(detected,true);assert.equal(state.violations,1,'a real shoulder stop must resolve the pursuit');
  assert.ok(stoppedAt!==null&&arrivedAt!==null);assert.ok(state.drivingTime-arrivedAt!>=1.98,'attendance takes two continuous seconds');
  assert.ok(state.distance-officer.distance>=50&&state.distance-officer.distance<=70,'officer remains visible behind after stopping');
  assert.equal(officer.speed,0);
});

test('moving street patrol and parked radar occupy distinct physical states before a violation',()=>{
  const radar=createRun({seed:42}),patrol=createRun({seed:0});
  for(const s of [radar,patrol]){s.distance=s.counties[0].police!.trigger-5500;s.speed=0;s.x=.75;updateRun(s,idle,1/60);}
  const radarCar=radar.traffic.find(c=>c.role==='police')!,patrolCar=patrol.traffic.find(c=>c.role==='police')!;
  assert.equal(radarCar.speed,0);assert.ok(radarCar.x>1,'radar waits in the roadside space');
  const before=patrolCar.distance;updateRun(patrol,idle,1);
  assert.ok(patrolCar.speed>40);assert.ok(patrolCar.distance>before);assert.ok(patrolCar.x<=1,'street patrol uses the right driving lane');
});

test('a nearby patrol notices a badly damaged vehicle even below the speed limit',()=>{
  const state=createRun({seed:0});const event=state.counties[0].police!;
  state.distance=event.trigger-100;state.speed=50;state.gear=1;state.condition=20;state.x=.75;
  updateRun(state,idle,1/60);
  assert.equal(state.police.mode,'pursuit');
});

test('a distant offroad stop never receives a remote ticket',()=>{
  const state=createRun({seed:42});const event=state.counties[0].police!;
  state.distance=event.trigger-200;state.speed=220;state.gear=4;updateRun(state,idle,1/60);
  state.speed=0;state.x=3.5;updateRun(state,idle,20);
  assert.equal(state.violations,0);assert.equal(state.police.catchProgress,0);
});

test('stopping across the opposing carriageway does not receive a remote ticket',()=>{
  const state=createRun({seed:42});const event=state.counties[0].police!;
  state.distance=event.trigger-200;state.speed=220;state.gear=4;updateRun(state,idle,1/60);
  state.speed=0;state.x=-.75;updateRun(state,idle,20);
  assert.equal(state.violations,0);assert.equal(state.police.catchProgress,0);
});

test('a lawful slow drive retires distant patrols and remains saveable across later counties',()=>{
  const state=createRun({seed:0});const stop=SERVICES[1];let firstOfficer='',retired=false;
  for(let frame=0;frame<60*1400&&state.status==='driving';frame++){
    const target=Math.min(50,Math.sqrt(2*40*3.6*Math.max(0,stop.distance-180-state.distance)/TIME_SCALE));
    const input=driveTraffic(state,target);
    if(state.distance>stop.distance-2300)input.steer=Math.max(-1,Math.min(1,(1.75-state.x)*12));
    updateRun(state,input,1/60);
    firstOfficer ||= state.traffic.find(c=>c.role==='police')?.id??'';
    if(firstOfficer&&!state.traffic.some(c=>c.id===firstOfficer))retired=true;
  }
  assert.equal(state.status,'service');assert.equal(state.serviceId,stop.id);assert.ok(state.countyIndex>=1);assert.equal(retired,true,'a patrol driving away cannot monopolize all later county events');
  assert.equal(state.counties[0].police!.resolved,true);assert.ok(Math.abs(state.police.gap)<=6500);
  assert.ok(serializeRun(state),'retired patrol metadata must not invalidate a naturally reached later service save');
});

function levels(state:ReturnType<typeof createRun>){
  const values:{siren?:number;horn?:number}={};const audio=new GameAudio() as any;
  audio.context={currentTime:0};audio.master={gain:{setTargetAtTime(){}}};
  audio.sirenGain={gain:{setTargetAtTime(value:number){values.siren=value;}}};
  audio.hornGain={gain:{setTargetAtTime(value:number){values.horn=value;}}};
  const previousWindow=globalThis.window;
  try{globalThis.window={} as Window & typeof globalThis;audio.update(state,{view:'arcade',resolution:'640x360',map:false,units:'kmh',sound:true,speech:false});}
  finally{if(previousWindow===undefined)delete (globalThis as any).window;else globalThis.window=previousWindow;}
  return values;
}

test('siren sound follows the actual nearby actor in either direction and is silent without it or across routes',()=>{
  const state=createRun({seed:42});state.distance=30000;state.police.mode='pursuit';state.police.eventId='test';state.police.gap=25;
  assert.equal(levels(state).siren,0,'pursuit metadata alone must never produce a siren');
  const officer={id:'police:test',distance:30100,x:.75,speed:0,color:'#eee',body:'sedan' as const,oncoming:false,role:'police' as const,route:'main' as 'main'|'detour',siren:true};
  state.traffic.push(officer);const ahead=levels(state).siren!;assert.ok(ahead>0);
  officer.distance=29900;state.police.gap=10000;assert.equal(levels(state).siren,ahead,'stale or signed gap cannot alter actor sound');
  officer.route='detour';assert.equal(levels(state).siren,0);
  officer.route='main';officer.distance=28000;assert.equal(levels(state).siren,0,'distant sirens fade out completely');
  officer.distance=29900;officer.siren=false;assert.equal(levels(state).siren,0);
});

test('a short horn is audible only while an actual nearby car horn is active',()=>{
  const state=createRun();state.distance=30000;state.drivingTime=10;
  state.traffic[0].distance=30100;state.traffic[0].x=.75;state.traffic[0].route='main';
  state.traffic[0].hornUntil=10.2;
  assert.ok(levels(state).horn!>0);
  state.drivingTime=10.3;assert.equal(levels(state).horn,0);
  state.drivingTime=10;state.traffic[0].distance=34000;assert.equal(levels(state).horn,0);
  state.traffic[0].distance=30100;state.traffic[0].hornUntil=60;assert.equal(levels(state).horn,0,'unbounded horn metadata is silent');
});

test('a watched speeding rival receives one timed police stop and keeps its physical braking motion',()=>{
  const state=createRun({seed:42});const event=state.counties[0].police!;
  state.distance=event.trigger-200;state.speed=50;state.gear=1;state.x=.75;
  const rival=state.rivals[0],car=state.traffic.find(c=>c.id===rival.id)!;
  rival.distance=event.trigger-450;Object.assign(car,{distance:rival.distance,x:.25,targetX:.25,speed:150,desiredSpeed:150});
  updateRun(state,idle,1/60);
  assert.equal(state.police.mode,'watching');assert.equal(state.violations,0,'the rival incident does not ticket the player');
  assert.equal(rival.violations,1);assert.ok(rival.policeStopUntil!>=state.elapsed+479.9);
  assert.ok(car.speed>100,'police observation does not teleport or instantly stop a moving rival');
  const until=rival.policeStopUntil;updateRun(state,idle,2);
  assert.equal(rival.violations,1);assert.equal(rival.policeStopUntil,until,'each event/team pair is processed once');
});

test('a rival on a separate route cannot receive a remote checkpoint penalty',()=>{
  const state=createRun({seed:42});const event=state.counties[0].police!;
  state.distance=event.trigger-200;state.speed=50;state.gear=1;
  const rival=state.rivals[0],car=state.traffic.find(c=>c.id===rival.id)!;
  Object.assign(car,{distance:event.trigger-450,x:.25,targetX:.25,speed:150,desiredSpeed:150,route:'detour'});
  updateRun(state,idle,1/60);assert.equal(rival.violations??0,0);assert.equal(rival.policeStopUntil??0,0);
});

test('a sixty second pursuit delayed by traffic does not falsely escape while the officer remains close',()=>{
  const state=createRun({seed:3});const event=state.counties[0].police!;
  state.distance=event.trigger-200;state.x=.25;state.speed=255;state.gear=4;
  let slowest=255;
  for(let frame=0;frame<3600;frame++){updateRun(state,driveTraffic(state,255),1/60);slowest=Math.min(slowest,state.speed);}
  assert.ok(slowest<120,'traffic actually interrupted the escape attempt');
  assert.ok(state.police.gap<=700,'officer caught up physically');
  assert.equal(state.escapes,0);assert.equal(state.police.mode,'pursuit');
});
