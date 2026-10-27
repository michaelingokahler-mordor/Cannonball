import { driveTraffic } from './helpers/driver.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BRANCH, SERVICES } from '../src/data.ts';
import { detourOffset, getRouteOffset } from '../src/layout.ts';
import { generateCounties } from '../src/road.ts';
import { createRun, updateRun, enterService, serviceAction, chooseRoute, serializeRun, restoreRun } from '../src/simulation.ts';
const idle={throttle:0,brake:0,steer:0};

test('only a stopped car in a physical parking bay enters service, then leaving blocks reopening',()=>{
 const s=createRun();s.distance=SERVICES[0].distance;s.speed=0;s.x=.75;
 assert.equal(enterService(s),false);
 s.x=1.75;s.speed=20;assert.equal(enterService(s),false);
 s.speed=0;updateRun(s,idle,1/60);assert.equal(s.status,'service');
 serviceAction(s,'leave');updateRun(s,idle,1);assert.equal(s.status,'driving');
 s.x=.75;updateRun(s,idle,1/60);s.x=1.75;updateRun(s,idle,1/60);assert.equal(s.status,'service');
});

test('the paved apron does not cause offroad damage and a service building is solid',()=>{
 const s=createRun();const stop=SERVICES[0];s.distance=stop.distance-1200;s.x=1.75;s.speed=30;s.gear=1;
 const before=s.condition;updateRun(s,idle,1);assert.ok(s.condition>before-.1);
 s.distance=stop.distance+445;s.x=2.75;s.speed=50;updateRun(s,idle,.2);
 assert.equal(s.speed,0);assert.ok(s.distance<stop.distance+450);assert.ok(s.condition<before);
});

test('steering across the physical fork overrides button intent and preserves world position',()=>{
 const detour=createRun();detour.distance=BRANCH.decision-1;detour.x=1.3;detour.speed=100;detour.gear=3;
 updateRun(detour,idle,1/60);assert.equal(detour.route,'detour');
 assert.ok(Math.abs(detour.x+getRouteOffset(detour.distance,detour.route)-1.3)<.02);
 const main=createRun();main.distance=BRANCH.start;assert.equal(chooseRoute(main,'detour'),true);
 main.distance=BRANCH.decision-1;main.x=.75;main.speed=100;main.gear=3;updateRun(main,idle,1/60);
 assert.equal(main.route,'main');assert.equal(main.routeChoice,'main');
 detour.distance=BRANCH.end-1;detour.x=.2;const before=detour.x+detourOffset(detour.distance);updateRun(detour,idle,1/60);
 assert.equal(detour.route,'main');assert.ok(Math.abs(detour.x-before)<.02);
});

test('ordinary traffic is calmer, keeps trucks, and brakes for a stopped player',()=>{
 const s=createRun({seed:42});assert.equal(s.traffic.filter(c=>c.body==='truck').length,3);
 for(const c of s.traffic.filter(c=>c.role==='traffic'))assert.ok(c.speed<=85&&c.speed>0);
 s.distance=20000;s.x=.75;s.speed=0;const follower=s.traffic[1];follower.distance=s.distance-100;follower.x=.75;follower.speed=80;follower.desiredSpeed=80;
 const before=s.condition;let avoided=false;
 for(let i=0;i<300;i++){
   updateRun(s,idle,1/60);avoided||=follower.speed<70||Math.abs(follower.x-s.x)>.25;
   assert.ok(Math.abs(follower.distance-s.distance)>=24||Math.abs(follower.x-s.x)>=.24,'NPC passed through the player');
 }
 assert.equal(s.condition,before);assert.ok(avoided);
});

test('a car hitting the player from behind is separated without repeatedly damaging the player',()=>{
 const s=createRun();s.distance=20000;s.speed=0;s.x=.75;const car=s.traffic[1];car.distance=19998;car.x=.75;car.speed=80;car.desiredSpeed=80;
 updateRun(s,idle,1/60);const before=s.condition;for(let i=0;i<120;i++)updateRun(s,idle,1/60);
 assert.equal(s.condition,before);assert.ok(car.distance<s.distance-20||Math.abs(car.x-s.x)>.25);
});

test('police are visible before detection and use the same continuously moving car',()=>{
 const s=createRun({seed:42});const event=s.counties[0].police!;s.distance=event.trigger-4000;s.speed=80;s.gear=3;
 updateRun(s,idle,1/60);assert.equal(s.police.mode,'watching');const officer=s.traffic.find(c=>c.role==='police')!;
 assert.ok(officer);assert.equal(officer.distance,event.trigger-500);const id=officer.id;
 s.distance=event.trigger-200;s.speed=220;s.gear=4;updateRun(s,idle,1/60);
 assert.equal(s.police.mode,'pursuit');assert.equal(s.traffic.find(c=>c.role==='police')!.id,id);
 assert.ok(Math.abs(officer.distance-(event.trigger-500))<10);
});

test('yielding needs officer arrival and two real seconds; evasion takes at least thirty real seconds',()=>{
 const s=createRun({seed:42});const event=s.counties[0].police!;s.distance=event.trigger-200;s.speed=220;s.gear=4;updateRun(s,idle,1/60);
 s.speed=0;s.x=1.2;updateRun(s,idle,.5);assert.equal(s.violations,0);
 for(let i=0;i<600&&s.violations===0;i++)updateRun(s,idle,1/60);
 assert.equal(s.violations,1);assert.ok(s.police.catchProgress===0);assert.ok(s.traffic.some(c=>c.role==='police'));
 const flee=createRun({seed:42});const e=flee.counties[0].police!;flee.distance=e.trigger-200;flee.speed=255;flee.gear=4;
 updateRun(flee,{throttle:1,brake:0,steer:0},1/60);flee.police.gap=5000;
 updateRun(flee,{throttle:1,brake:0,steer:0},10);assert.equal(flee.police.mode,'pursuit');assert.equal(flee.escapes,0);
});

test('counties retain fixed roll/candidate and escapes deterministically promote only future checks',()=>{
 const counties=generateCounties(42);assert.ok(counties.every(c=>typeof c.policeRoll==='number'&&c.policeCandidate.id));
 const a=createRun({seed:42}),b=createRun({seed:42});assert.deepEqual(a.counties,b.counties);
 assert.ok(a.counties.some(c=>c.police===null));
});

test('v2 service snapshots validate new fields and v1 migration preserves resources, time and RNG',()=>{
 const s=createRun({seed:42});s.distance=SERVICES[0].distance;s.x=1.75;s.speed=0;assert.equal(enterService(s),true);
 s.fuel=31;s.condition=77;s.fatigue=[39,14];serviceAction(s,'refuel');
 const raw=serializeRun(s)!;assert.ok(raw);assert.equal(JSON.parse(raw).version,2);assert.deepEqual(restoreRun(raw),s);
 const v1=JSON.parse(raw);v1.version=1;delete v1.escapes;delete v1.serviceExitBlock;delete v1.police.pursuitTime;
 for(const c of v1.counties){delete c.policeRoll;delete c.policeCandidate;}for(const c of v1.traffic){delete c.route;delete c.condition;delete c.desiredSpeed;delete c.targetX;}
 v1.x=.75;v1.distance+=1500;
 const restored=restoreRun(JSON.stringify(v1))!;assert.ok(restored);assert.equal(restored.version,2);assert.equal(restored.x,1.75);assert.equal(restored.distance,SERVICES[0].distance);
 for(const key of ['fuel','condition','fatigue','rng','elapsed','drivingTime','timePenalties','serviced'])assert.deepEqual(restored[key as keyof typeof restored],s[key as keyof typeof s]);
 for(const key of ['escapes','serviceExitBlock']){const bad=JSON.parse(raw);bad[key]=key==='escapes'?-1:'fake';assert.equal(restoreRun(JSON.stringify(bad)),null);}
});

test('an overtaking car waits for a fast player approaching in the passing lane',()=>{
 const s=createRun();s.distance=20000;s.x=.25;s.speed=255;s.gear=4;
 const car=s.traffic[1];Object.assign(car,{distance:21000,x:.75,targetX:.75,speed:80,desiredSpeed:80});
 const truck=s.traffic[7];Object.assign(truck,{distance:21100,x:.75,targetX:.75,speed:55,desiredSpeed:55});
 updateRun(s,{throttle:1,brake:0,steer:0},1/60);assert.equal(car.targetX,.75);
});

test('ordinary traffic slows to the actual lower town speed limit',()=>{
 const s=createRun();s.distance=74500;s.x=1.2;s.speed=0;
 const car=s.traffic[1];Object.assign(car,{distance:75010,x:.75,targetX:.75,speed:85,desiredSpeed:85});
 updateRun(s,idle,1);assert.ok(car.speed<=35*1.609344+.01);
});

test('a real escape takes thirty to sixty seconds, keeps the officer, and raises future checks without RNG',()=>{
 // This seeded road/controller run sustains the required physical separation.
 // A player delayed by traffic remains in pursuit, covered separately below.
 const s=createRun({seed:25});const event=s.counties[0].police!;
 s.distance=event.trigger-200;s.x=.25;s.speed=255;s.gear=4;
 const before=s.counties.map(c=>({roll:c.policeRoll,candidate:structuredClone(c.policeCandidate),had:!!c.police}));
 let elapsed=0,officerId='';
 for(let i=0;i<3600&&s.escapes===0;i++){
   updateRun(s,driveTraffic(s,255),1/60);elapsed+=1/60;
   officerId ||= s.traffic.find(c=>c.role==='police')?.id??'';
 }
 assert.equal(s.escapes,1);assert.ok(elapsed>=30&&elapsed<=60,`${elapsed} real seconds`);
 assert.ok(s.traffic.some(c=>c.id===officerId));assert.equal(s.police.mode,'escaped');
 const eligible=s.counties.find((c,i)=>c.start>s.distance&&!before[i].had&&before[i].roll<.68);assert.ok(eligible);assert.ok(eligible.police);
 s.counties.forEach((c,i)=>{assert.equal(c.policeRoll,before[i].roll);assert.deepEqual(c.policeCandidate,before[i].candidate);});
 const escapes=s.escapes;updateRun(s,idle,1/60);assert.equal(s.escapes,escapes);
});

test('a stopped player cannot be ticketed until the officer is actually alongside in world space',()=>{
 const s=createRun({seed:42});const event=s.counties[0].police!;s.distance=event.trigger-200;s.x=.75;s.speed=220;s.gear=4;
 updateRun(s,{throttle:1,brake:0,steer:0},1/60);s.speed=0;s.x=3.5;
 const officer=s.traffic.find(c=>c.role==='police')!;officer.distance=s.distance-25;officer.x=.25;officer.speed=0;
 updateRun(s,idle,2.1);assert.equal(s.violations,0);assert.equal(s.police.mode,'pursuit');
 assert.ok(Math.abs((s.traffic.find(c=>c.role==='police')!.x)-s.x)>.3);
});

test('a committed overtake does not weave back right before passing its leader',()=>{
 const s=createRun();s.distance=20000;s.x=1.75;s.speed=0;
 const car=s.traffic[1];Object.assign(car,{distance:21000,x:.75,targetX:.75,speed:85,desiredSpeed:85});
 const truck=s.traffic[7];Object.assign(truck,{distance:21350,x:.75,targetX:.75,speed:65,desiredSpeed:65});
 let changes=0,last=car.targetX;
 for(let i=0;i<375;i++){
  updateRun(s,idle,1/60);if(car.targetX!==last){changes++;last=car.targetX;}
 }
 assert.ok(changes<=1,`Changed target ${changes} times before overtaking`);
 assert.equal(car.targetX,.25);assert.ok(car.distance<truck.distance+75);
 for(let i=0;i<900;i++)updateRun(s,idle,1/60);
 assert.ok(car.distance>truck.distance+75);assert.equal(car.targetX,.75);assert.equal(car.passingId,null);
});

test('race teams keep highway racing pace while ordinary cars and trucks remain calmer',()=>{
 const s=createRun({seed:42});s.distance=20000;s.x=1.75;s.speed=0;
 const rival=s.traffic.find(c=>c.role==='rival')!;Object.assign(rival,{distance:24000,x:.25,targetX:.25,speed:140,desiredSpeed:140,passingId:'player'});
 updateRun(s,idle,.5);
 assert.ok(rival.speed>125,'Highway rival must retain its racing pace');
 assert.ok(s.traffic.filter(c=>c.role==='traffic').every(c=>c.speed<=85));
 assert.ok(s.traffic.filter(c=>c.body==='truck').every(c=>c.speed<=70));
 s.distance=74500;rival.distance=75010;rival.x=.25;rival.targetX=.25;rival.speed=140;
 updateRun(s,idle,2);assert.ok(rival.speed<=35*1.609344+.01,'Rival must slow in towns');
});

test('a pursuit that misses the detour eventually loses sight instead of remotely ticketing or trapping the player',()=>{
 const s=createRun({seed:42});const event=s.counties[0].police!;event.activated=true;
 s.distance=120000;s.route='detour';s.routeChoice='detour';s.x=.2;s.speed=0;
 s.police={mode:'pursuit',gap:25,eventId:event.id,catchProgress:0,cooldown:0,pursuitTime:30};
 s.traffic.push({id:`police:${event.id}`,distance:119975,x:1.18,speed:0,color:'#eee',body:'sedan',role:'police',oncoming:false,route:'main'});
 updateRun(s,idle,6);
 assert.equal(s.violations,0);assert.equal(s.escapes,1);assert.equal(s.police.mode,'escaped');
});

test('an officer reaches the physical fork continuously and can follow a legitimate detour pullover',()=>{
 const s=createRun({seed:42});const event=s.counties[0].police!;event.activated=true;
 s.distance=103000;s.route='detour';s.routeChoice='detour';s.x=.2;s.speed=0;
 s.police={mode:'pursuit',gap:1400,eventId:event.id,catchProgress:0,cooldown:0,pursuitTime:10};
 const officer={id:`police:${event.id}`,distance:101600,x:1.3,speed:220,color:'#eee',body:'sedan' as const,role:'police' as const,oncoming:false,route:'main' as 'main'|'detour'};
 s.traffic.push(officer);let followed=false;
 for(let i=0;i<900&&s.violations===0;i++){
  const before=officer.x+getRouteOffset(officer.distance,officer.route),route=officer.route;
  updateRun(s,idle,1/60);
  if(route==='main'&&officer.route==='detour'){
   followed=true;assert.ok(Math.abs(officer.x+getRouteOffset(officer.distance,officer.route)-before)<.04,'Officer teleported laterally at the fork');
  }
 }
 assert.equal(followed,true);assert.equal(s.violations,1);assert.equal(s.police.mode,'caught');
});
