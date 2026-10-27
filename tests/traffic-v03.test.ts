import test from 'node:test';
import assert from 'node:assert/strict';
import type { RunState, TrafficCar } from '../src/model.ts';
import { createRun, updateRun, shiftGear, enterService, serializeRun, restoreRun } from '../src/simulation.ts';
import { getRouteOffset } from '../src/layout.ts';
import { SERVICES, VEHICLES } from '../src/data.ts';
import { updateRoadTraffic, rememberTrafficPlayerPose, rivalPolicy } from '../src/traffic.ts';

const world=(car:{distance:number;x:number;route?:'main'|'detour'})=>car.x+getRouteOffset(car.distance,car.route??'main');
function clearPlayer(state:RunState,frame:number){
 for(const car of state.traffic){
  if(car.role==='police')continue;
  const half=car.body==='truck'?.23:car.body==='van'||car.body==='rv'?.20:.185;
  assert.ok(Math.abs(car.distance-state.distance)>=27.999||Math.abs(world(car)-world(state))>=half+.185-1e-5,
   `frame ${frame} ${car.id}: gap ${car.distance-state.distance}, lateral ${world(car)-world(state)}`);
 }
}
function drive(state:RunState,target:number,lane:number){
 const v=VEHICLES.find(v=>v.id===state.vehicleId)!;
 if(state.gear<v.gears&&state.speed>v.gearSpeeds[state.gear-1]*.89)shiftGear(state,1);
 return {throttle:state.speed<target-.2?1:0,brake:state.speed>target+.2?1:0,steer:Math.max(-1,Math.min(1,(lane-state.x)/((1/60)*(.3+state.speed/100))*.2))};
}

test('continuous seed99 lane changes retain solid player bodies through rival passes',()=>{
 const s=createRun({seed:99});
 for(let frame=0;frame<4800;frame++){
  updateRun(s,drive(s,115,Math.floor(frame/540)%2?.25:.75),1/60);
  clearPlayer(s,frame+1);
 }
 assert.equal(s.status,'driving');
});

test('continuous seed1976 acceleration, hard braking and restart keep queues separated',()=>{
 const s=createRun({seed:1976});
 for(let frame=0;frame<4500;frame++){
  const t=frame/60,target=t<20||t>50?180:0,lane=t<20?.25:.75;
  updateRun(s,drive(s,target,lane),1/60);clearPlayer(s,frame+1);
 }
 assert.equal(s.status,'driving');
});

test('continuous acceleration, braking and lane changes keep every ordinary and rival pair separated',()=>{
 for(const seed of [0,7,42,99,1976]){
  const s=createRun({seed});
  for(let frame=0;frame<4200;frame++){
   const target=frame>=1800&&frame<2400?0:155,lane=Math.floor(frame/660)%2?.25:.75;
   updateRun(s,drive(s,target,lane),1/60);clearPlayer(s,frame+1);
   const cars=s.traffic.filter(c=>c.role!=='police');
   for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++){
    const a=cars[i],b=cars[j],half=(c:TrafficCar)=>c.body==='truck'?.23:c.body==='van'||c.body==='rv'?.20:.185;
    assert.ok(Math.abs(a.distance-b.distance)>=27.999||Math.abs(world(a)-world(b))>=half(a)+half(b)-1e-5,
     `seed ${seed} frame ${frame+1}: ${a.id}/${b.id} overlap`);
   }
  }
  assert.equal(s.status,'driving');
 }
});

const hooks={log:(_text:string)=>{},say:(_text:string,_priority?:number)=>{}};
function car(id:string,distance:number,x:number,speed:number,body:TrafficCar['body']='sedan'):TrafficCar {
 return {id,distance,x,speed,body,targetX:x,desiredSpeed:speed,condition:100,color:'#abc',oncoming:false,role:'traffic',route:'main'};
}
function fixture(){const s=createRun({seed:99});s.distance=20000;s.x=.75;s.speed=60;s.gear=2;s.traffic=[];s.rivals=[];return s;}

test('side intrusion during a rival pass is stopped at the common visible body edge',()=>{
 const s=fixture();s.speed=35;s.x=.65;s.traffic=[car('rival-1',20000,.25,118)];s.traffic[0].role='rival';
 rememberTrafficPlayerPose(s);s.x=.60;s.distance+=35/3.6*8/60;
 updateRoadTraffic(s,1/60,hooks);
 assert.ok(s.x>=.6249);assert.ok(Math.abs(s.traffic[0].x-s.x)>=.3749);
 assert.ok(s.distance>=20000,'side contact must not teleport the player backwards');
});

test('a front impact rechecks the rear queue and is independent of traffic array order',()=>{
 const base=fixture();base.traffic=[car('a-rear',19972,.75,75),car('b-front',20028,.75,0),car('c-rear',19944,.75,80)];
 const a=structuredClone(base),b=structuredClone(base);b.traffic.reverse();
 for(const s of [a,b]){rememberTrafficPlayerPose(s);s.distance+=60/3.6*8/60;updateRoadTraffic(s,1/60,hooks);clearPlayer(s,1);}
 assert.equal(a.distance,b.distance);assert.equal(a.speed,b.speed);
 assert.deepEqual(a.traffic.map(c=>({id:c.id,d:c.distance,x:c.x,speed:c.speed})).sort((x,y)=>x.id.localeCompare(y.id)),b.traffic.map(c=>({id:c.id,d:c.distance,x:c.x,speed:c.speed})).sort((x,y)=>x.id.localeCompare(y.id)));
 const sorted=[...a.traffic,{id:'player',distance:a.distance,x:a.x}].sort((x,y)=>x.distance-y.distance);
 for(let i=1;i<sorted.length;i++)assert.ok(sorted[i].distance-sorted[i-1].distance>=27.999);
});

test('an NPC cutting into a stationary player stops at the side without moving or damaging the player',()=>{
 const s=fixture();s.speed=0;const intruder=car('intruder',20000,.30,0);intruder.targetX=.75;s.traffic=[intruder];
 for(let i=0;i<30;i++){rememberTrafficPlayerPose(s);updateRoadTraffic(s,1/60,hooks);s.drivingTime+=1/60;s.elapsed+=8/60;}
 assert.equal(s.x,.75);assert.equal(s.distance,20000);assert.equal(s.condition,100);
 assert.ok(s.x-intruder.x>=.3749);
});

test('swept contact prevents a fast player crossing an entire stopped body',()=>{
 const s=fixture();s.distance=20000;s.traffic=[car('stopped',20060,.75,0)];
 rememberTrafficPlayerPose(s);s.distance=20100;updateRoadTraffic(s,1/60,hooks);
 assert.ok(s.distance<=20032);assert.ok(s.traffic[0].distance-s.distance>=27.999);
});

test('ordinary traffic brakes for police bodies without moving the officer',()=>{
 const s=fixture();s.x=1.75;s.speed=0;
 const officer=car('police:fixture',20200,.75,0);officer.role='police';
 const truck=car('truck',20000,.75,65,'truck');s.traffic=[truck,officer];
 for(let i=0;i<240;i++){rememberTrafficPlayerPose(s);updateRoadTraffic(s,1/60,hooks);s.drivingTime+=1/60;s.elapsed+=8/60;}
 assert.equal(officer.distance,20200);assert.equal(officer.x,.75);assert.equal(officer.speed,0);
 assert.ok(truck.distance<=20172);assert.ok(truck.speed<10);
});

test('a moving player contacting a parked officer receives the ordinary collision response',()=>{
 const s=fixture();const officer=car('police:fixture',20035,.75,0);officer.role='police';s.traffic=[officer];
 rememberTrafficPlayerPose(s);s.distance=20020;updateRoadTraffic(s,1/60,hooks);
 assert.ok(s.condition<100);assert.equal(s.speed,0);assert.equal(officer.distance,20035);
});

test('police movement after traffic cannot cross a stopped queue or move its cars twice',async()=>{
 const mod=await import('../src/traffic.ts') as {resolveTrafficAfterPolice?:(s:RunState,dt:number,h:typeof hooks)=>void};
 const s=fixture();s.distance=21000;s.x=.75;s.speed=0;
 const blocker=car('stopped',20060,.75,0),officer=car('police:fixture',20000,.75,180);officer.role='police';
 s.traffic=[blocker,officer];rememberTrafficPlayerPose(s);updateRoadTraffic(s,1/60,hooks);
 const settled=blocker.distance;officer.distance=20080;
 mod.resolveTrafficAfterPolice?.(s,1/60,hooks);
 assert.ok(officer.distance<=settled-27.999,'the officer must remain behind the queue it approached');
 assert.equal(blocker.distance,settled);assert.equal(s.distance,21000);assert.equal(officer.speed,0);
});

test('an aligned following truck brakes before a stopped player and emits one bounded horn request',()=>{
 const s=fixture();s.speed=0;const truck=car('truck',19940,.75,60,'truck');s.traffic=[truck];
 let horns=0,prior=0;
 for(let i=0;i<180;i++){
  rememberTrafficPlayerPose(s);updateRoadTraffic(s,1/60,hooks);clearPlayer(s,i);
  if((truck.hornUntil??0)>prior){horns++;prior=truck.hornUntil!;assert.ok(prior-s.drivingTime<=.351);}
  s.drivingTime+=1/60;s.elapsed+=8/60;
 }
 assert.equal(s.condition,100);assert.ok(truck.speed<1);assert.equal(horns,1);
});

test('rival strategies use bounded pace and distinguish early police awareness',()=>{
 for(const [id,cruise,style] of [['rival-0',142,'bold'],['rival-1',118,'balanced'],['rival-2',90,'cautious'],['rival-3',105,'efficient']] as const){
  const s=fixture();s.x=1.75;s.speed=0;const r=car(id,22000,.25,140);r.role='rival';
  const officer=car('police:fixture',23000,1.18,0);officer.role='police';s.traffic=[r,officer];
  for(let i=0;i<60;i++)updateRoadTraffic(s,1/60,hooks);
  assert.equal(rivalPolicy(id).style,style);assert.ok(r.speed<=cruise+.001);
  if(style!=='bold')assert.ok(r.speed<=88.514,'aware rivals respect the posted highway limit before police');
 }
});

test('a rival observed by police brakes and pulls over continuously, then resumes safely',()=>{
 const s=fixture();s.x=1.75;s.speed=0;const r=car('rival-0',22000,.75,120);r.role='rival';s.traffic=[r];
 s.rivals=[{id:r.id,name:'Red Arrow',color:'#abc',distance:r.distance,speed:142,stopUntil:0,policeStopUntil:480}];
 updateRoadTraffic(s,1/60,hooks);assert.ok(r.speed>118);assert.ok(r.x>.75&&r.x<.77);
 for(let i=0;i<120;i++){updateRoadTraffic(s,1/60,hooks);s.elapsed+=8/60;s.drivingTime+=1/60;}
 assert.equal(r.speed,0);assert.ok(Math.abs(r.x-1.18)<.001);
 s.elapsed=481;updateRoadTraffic(s,1/60,hooks);assert.ok(r.speed>0);assert.equal(r.targetX,.75);
});

test('a planned rival pit stop brakes and pulls right continuously, holds, then merges only into a free lane',()=>{
 const s=fixture();s.x=1.75;s.speed=0;const r=car('rival-0',100050,.75,120);r.role='rival';s.traffic=[r];
 s.rivals=[{id:r.id,name:'Red Arrow',color:'#abc',distance:r.distance,speed:142,stopUntil:480}];
 s.triggered.push('rival-0:stop:1');
 updateRoadTraffic(s,1/60,hooks);assert.ok(r.speed>118&&r.speed<120);assert.ok(r.x>.75&&r.x<.77);
 for(let i=0;i<180;i++){updateRoadTraffic(s,1/60,hooks);s.elapsed+=8/60;s.drivingTime+=1/60;}
 assert.equal(r.speed,0);assert.ok(Math.abs(r.x-1.18)<.001);const parked=r.distance;
 for(let i=0;i<120;i++){updateRoadTraffic(s,1/60,hooks);s.elapsed+=8/60;s.drivingTime+=1/60;}
 assert.equal(r.distance,parked);assert.equal(r.speed,0);
 const passing=car('nearby-pass',r.distance+50,.75,80);s.traffic.push(passing);s.elapsed=481;
 updateRoadTraffic(s,1/60,hooks);assert.equal(r.targetX,1.18,'nearby traffic must prevent the return into its lane');
 s.traffic=s.traffic.filter(c=>c!==passing);updateRoadTraffic(s,1/60,hooks);
 assert.equal(r.targetX,.75);assert.ok(r.speed>0);assert.ok(r.x<1.18&&r.x>1.15);
});

test('rivals finish a long continuously ticking journey in distinct bounded slots and permit saving before purchase',()=>{
 const s=createRun({seed:42});
 for(let minute=0;minute<40;minute++){
  updateRun(s,{throttle:0,brake:0,steer:0},60);
  assert.equal(s.status,'driving');
  assert.ok(s.rivals.every(r=>r.distance<=362000),`minute ${minute+1}: a finished rival exceeded the strict save bound`);
 }
 const positions=s.rivals.map(r=>r.distance);
 assert.deepEqual(positions,[361200,361320,361440,361560]);
 assert.equal(s.traffic.filter(c=>c.role==='traffic').length,20);assert.equal(s.traffic.filter(c=>c.role==='rival').length,4);
 assert.ok(s.traffic.filter(c=>c.role==='rival').every(c=>c.speed===0));
 updateRun(s,{throttle:0,brake:0,steer:0},10);assert.deepEqual(s.rivals.map(r=>r.distance),positions);
 const stop=SERVICES.find(stop=>stop.id==='keystone')!;s.distance=stop.distance;s.x=1.75;s.speed=0;
 assert.ok(enterService(s));const raw=serializeRun(s);assert.ok(raw,'saving at arrival must succeed without buying a service');
 assert.deepEqual(restoreRun(raw!),s);
});

test('a third rival strike causes continuous pull-over and permanent parking after its temporary ticket timer expires',()=>{
 const s=fixture();s.x=1.75;s.speed=0;const r=car('rival-0',22000,.75,120);r.role='rival';s.traffic=[r];
 s.rivals=[{id:r.id,name:'Red Arrow',color:'#abc',distance:r.distance,speed:142,stopUntil:0,violations:3,policeStopUntil:1}];
 updateRoadTraffic(s,1/60,hooks);assert.ok(r.speed>118&&r.speed<120);assert.ok(r.x>.75&&r.x<.77);
 for(let i=0;i<180;i++){updateRoadTraffic(s,1/60,hooks);s.elapsed+=8/60;s.drivingTime+=1/60;}
 assert.equal(r.speed,0);assert.ok(Math.abs(r.x-1.18)<.001);
 const parked=r.distance;s.elapsed=2000;
 for(let i=0;i<600;i++){updateRoadTraffic(s,1/60,hooks);s.elapsed+=8/60;s.drivingTime+=1/60;}
 assert.equal(r.speed,0);assert.equal(r.distance,parked);assert.equal(r.targetX,1.18);
});
