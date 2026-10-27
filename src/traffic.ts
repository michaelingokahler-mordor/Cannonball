import type { RunState, TrafficCar } from './model.ts';
import { CREW, STAGE_LENGTH, TIME_SCALE, VEHICLES } from './data.ts';
import { getRoadSample } from './road.ts';
import { getRouteOffset } from './layout.ts';
import { vehicleHalfWidth as trafficHalfWidth } from './vehicle-shapes.ts';
import { laneChangeIsClear } from './driving.ts';
export { trafficHalfWidth };

interface Pose { distance:number; x:number }
interface Actor { id:string; car?:TrafficCar; old:Pose; next:Pose; half:number; fixed:boolean }
export interface TrafficHooks { log:(text:string)=>void; say:(text:string,priority?:number)=>void }
const remembered=new WeakMap<RunState,Pose>();
const policePoses=new WeakMap<RunState,Map<string,Pose>>();
const EPS=1e-6, LENGTH=28, BODY_MARGIN=.005;
const approach=(v:number,t:number,n:number)=>v<t?Math.min(t,v+n):Math.max(t,v-n);
const wx=(d:number,x:number,route:'main'|'detour'='main')=>x+getRouteOffset(d,route);
export function rememberTrafficPlayerPose(state:RunState):void { remembered.set(state,{distance:state.distance,x:wx(state.distance,state.x,state.route)}); }
export function rivalPolicy(id:string):{style:string;cruise:number;policeAwareness:number} {
 const index=Number(id.split('-').at(-1));
 return [{style:'bold',cruise:142,policeAwareness:350},{style:'balanced',cruise:118,policeAwareness:1800},{style:'cautious',cruise:90,policeAwareness:1800},{style:'efficient',cruise:105,policeAwareness:1800}][index]??{style:'balanced',cruise:118,policeAwareness:1800};
}
/** Separate arrival slots keep every team inside the existing save bounds. */
export function rivalFinishDistance(id:string):number {
 const index=Math.max(0,Math.min(3,Number(id.split('-').at(-1))||0));
 return STAGE_LENGTH+1200+index*120;
}
function random(state:RunState):number { state.rng=(Math.imul(state.rng,1664525)+1013904223)>>>0;return state.rng/4294967296; }
function speedLimit(car:TrafficCar,distance=car.distance):number { return getRoadSample(distance,car.route??'main').speedLimit*1.609344; }
function desiredPace(state:RunState,car:TrafficCar):number {
 const posted=speedLimit(car);
 if(car.role!=='rival')return Math.min(car.desiredSpeed??car.speed,car.body==='truck'?70:85,posted);
 const policy=rivalPolicy(car.id),rival=state.rivals.find(r=>r.id===car.id);
 if(car.distance>=rivalFinishDistance(car.id)||(rival?.violations??0)>=3||rival&&Math.max(rival.stopUntil,rival.policeStopUntil??0)>state.elapsed)return 0;
 const bonus=policy.style==='bold'?55:policy.style==='balanced'?30:policy.style==='efficient'?18:0;
 let target=Math.min(policy.cruise,getRoadSample(car.distance,car.route??'main').speedLimit<55?posted:posted+bonus);
 if(state.traffic.some(c=>c.role==='police'&&Math.abs(c.distance-car.distance)<policy.policeAwareness&&Math.abs(wx(c.distance,c.x,c.route)-wx(car.distance,car.x,car.route))<1.5))target=Math.min(target,posted);
 return target;
}
function sweep(a:Actor,b:Actor):{time:number;axis:'x'|'distance'}|null {
 const z0=a.old.distance-b.old.distance,z1=a.next.distance-b.next.distance;
 const x0=a.old.x-b.old.x,x1=a.next.x-b.next.x,width=a.half+b.half+BODY_MARGIN;
 let enter=0,leave=1,axis:'x'|'distance'='distance';
 for(const [p,v,r,name] of [[z0,z1-z0,LENGTH,'distance'],[x0,x1-x0,width,'x']] as const){
  if(Math.abs(v)<EPS){if(Math.abs(p)>=r-EPS)return null;continue;}
  const u=(-r-p)/v,w=(r-p)/v,lo=Math.min(u,w),hi=Math.max(u,w);
  if(lo>enter){enter=lo;axis=name;}
  leave=Math.min(leave,hi);if(enter>leave+EPS)return null;
 }
 if(leave<0||enter>1)return null;
 // A new lateral intrusion must stop at the side, rather than teleporting a car
 // past a vehicle that was already alongside at the beginning of the tick.
 if(Math.abs(z0)<LENGTH&&Math.abs(x0)>=width-EPS)axis='x';
 return {time:Math.max(0,enter),axis};
}

export function updateRoadTraffic(state:RunState,dt:number,hooks:TrafficHooks):void {
 if(!Number.isFinite(dt)||dt<=0)return;
 const seconds=dt*TIME_SCALE,playerOld=remembered.get(state)??{distance:state.distance-state.speed/3.6*seconds,x:wx(state.distance,state.x,state.route)};
 const player:Actor={id:'player',old:playerOld,next:{distance:state.distance,x:wx(state.distance,state.x,state.route)},half:trafficHalfWidth(VEHICLES.find(v=>v.id===state.vehicleId)!.body),fixed:false};
 const ordered=[...state.traffic].sort((a,b)=>a.id.localeCompare(b.id));
 const actors:Actor[]=[player,...ordered.map(car=>({id:car.id,car,old:{distance:car.distance,x:wx(car.distance,car.x,car.route)},next:{distance:car.distance,x:wx(car.distance,car.x,car.route)},half:trafficHalfWidth(car.body),fixed:car.role==='police'}))];
 const byId=new Map(actors.map(a=>[a.id,a]));
 const speed=(a:Actor)=>a.car?.speed??state.speed;
 const signedSpeed=(a:Actor)=>speed(a)*(a.car?.oncoming?-1:1);
 for(const actor of actors.slice(1)){
  const car=actor.car!;if(actor.fixed)continue;
  car.route??='main';car.condition??=100;car.targetX??=car.x;
  car.desiredSpeed??=car.role==='rival'?rivalPolicy(car.id).cruise:Math.min(car.speed,car.body==='truck'?70:85);
  let target=desiredPace(state,car),direction=car.oncoming?-1:1;
  const rival=state.rivals.find(r=>r.id===car.id),roadsideHold=Math.max(rival?.stopUntil??0,rival?.policeStopUntil??0)>state.elapsed||(rival?.violations??0)>=3;
  const senseWidth=actor.half+player.half+.07;
  const ahead=actors.filter(other=>other!==actor&&(other.old.distance-actor.old.distance)*direction>0&&Math.abs(other.old.x-actor.old.x)<actor.half+other.half+.07)
   .map(other=>({actor:other,gap:(other.old.distance-actor.old.distance)*direction,speed:Math.max(0,signedSpeed(other)*direction)})).sort((a,b)=>a.gap-b.gap||a.actor.id.localeCompare(b.actor.id))[0];
  const laneSafe=(lane:number)=>laneChangeIsClear(
   {id:actor.id,distance:actor.old.distance,x:actor.old.x,targetX:lane,speed:car.speed,half:actor.half},lane,
   actors.map(other=>({id:other.id,distance:other.old.distance,x:other.old.x,
    targetX:other===player?player.next.x:other.car?wx(other.old.distance,other.car.targetX??other.car.x,other.car.route):other.old.x,
    speed:signedSpeed(other),half:other.half})),LENGTH
  )&&actors.every(other=>{
   if(other===actor)return true;
   const projected=other===player?player.next.x:other.car?wx(other.old.distance,other.car.targetX??other.car.x,other.car.route):other.old.x;
   if(Math.min(Math.abs(other.old.x-lane),Math.abs(projected-lane))>=actor.half+other.half+.045)return true;
   const gap=(other.old.distance-actor.old.distance)*direction,closing=gap<0?signedSpeed(other)*direction-car.speed:car.speed-signedSpeed(other)*direction;
   return Math.abs(gap)>(lane===.75?90:150)&&(closing<=0||Math.abs(gap)/(closing/3.6*TIME_SCALE)>(gap<0?3:1.6));
  });
  if(roadsideHold&&car.route==='main')car.targetX=1.18;
  else if(!car.oncoming&&car.route==='main'&&Math.abs(car.x-car.targetX)<.035){
   const passing=car.passingId?byId.get(car.passingId):undefined;
   if(car.x>1.05){if(laneSafe(.75)){car.targetX=.75;car.passingId=null;}}
   else if(car.x<.5&&(!passing||car.distance>passing.old.distance+100)&&laneSafe(.75)){car.targetX=.75;car.passingId=null;}
   else if(car.body!=='truck'&&car.x>.5&&ahead&&ahead.speed<target-3&&ahead.gap<220+car.speed*3&&laneSafe(.25)){
    const passDistance=target*(ahead.gap+150)/Math.max(1,target-ahead.speed);
    if(speedLimit(car,car.distance+Math.max(1500,passDistance))>=Math.min(target,speedLimit(car))-1){car.targetX=.25;car.passingId=ahead.actor.id;}
   }
  }
  if(ahead){
   const room=Math.max(0,ahead.gap-LENGTH-18),leadSpeed=ahead.speed;
   target=Math.min(target,Math.sqrt(leadSpeed**2+2*65*3.6*room/TIME_SCALE));
   if(!car.oncoming&&target<Math.min(car.desiredSpeed,desiredPace(state,car))-12&&ahead.gap<240&&car.speed<65){
    // Real driving seconds; one brief request, with a quiet interval thereafter.
    const last=hornTimes.get(car)??-10;
    if(state.drivingTime-last>4){car.hornUntil=state.drivingTime+.35;hornTimes.set(car,state.drivingTime);}
   }
  }
  // Predict the player's current steering corridor, including a cut-in occurring
  // this tick. A visible side obstruction is braking space, not permission to pass.
  if(!car.oncoming&&playerOld.distance>actor.old.distance&&Math.min(Math.abs(playerOld.x-actor.old.x),Math.abs(player.next.x-actor.old.x))<senseWidth){
   const room=Math.max(0,playerOld.distance-actor.old.distance-LENGTH-18);
   target=Math.min(target,Math.sqrt(state.speed**2+2*65*3.6*room/TIME_SCALE));
  }
  car.speed=approach(car.speed,target,(car.speed>target?90:8)*dt);
  actor.next.distance=actor.old.distance+direction*car.speed/3.6*seconds;
  actor.next.x=wx(actor.next.distance,approach(car.x,car.targetX,dt*.72),car.route);
 }
 resolveTrafficBodies(state,player,actors,hooks);
 finishRoadTraffic(state,actors,seconds);
 policePoses.set(state,new Map(actors.filter(a=>a.car?.role==='police').map(a=>[a.id,{...a.next}])));
 rememberTrafficPlayerPose(state);
}

/** The police controller moves after traffic. Resolve that one movement against
 * settled bodies, with no second acceleration, lane decision or clock advance. */
export function resolveTrafficAfterPolice(state:RunState,dt:number,hooks:TrafficHooks):void {
 const previous=policePoses.get(state);if(!previous||dt<=0)return;
 const player:Actor={id:'player',old:{distance:state.distance,x:wx(state.distance,state.x,state.route)},next:{distance:state.distance,x:wx(state.distance,state.x,state.route)},half:trafficHalfWidth(VEHICLES.find(v=>v.id===state.vehicleId)!.body),fixed:true};
 const actors:Actor[]=[player,...[...state.traffic].sort((a,b)=>a.id.localeCompare(b.id)).map(car=>{
  const pose={distance:car.distance,x:wx(car.distance,car.x,car.route)};
  return {id:car.id,car,old:car.role==='police'?(previous.get(car.id)??pose):pose,next:{...pose},half:trafficHalfWidth(car.body),fixed:car.role!=='police'};
 })];
 resolveTrafficBodies(state,player,actors,hooks);
 const officer=state.traffic.find(c=>c.role==='police');if(officer)state.police.gap=state.distance-officer.distance;
 rememberTrafficPlayerPose(state);
}

function resolveTrafficBodies(state:RunState,player:Actor,actors:Actor[],hooks:TrafficHooks):void {
 const signedSpeed=(a:Actor)=>(a.car?.speed??state.speed)*(a.car?.oncoming?-1:1);
 const damaged=new Set<string>();
 function impact(other:Actor,rear:boolean){
  if(damaged.has(other.id))return;damaged.add(other.id);
  const car=other.car!;const amount=Math.max(2,Math.abs(state.speed-signedSpeed(other))*.07);
  if(state.collisionCooldown===0){
   car.condition=Math.max(0,(car.condition??100)-amount);
   if(!rear){
    const v=VEHICLES.find(v=>v.id===state.vehicleId)!;state.condition=Math.max(0,state.condition-amount*100/v.robustness);state.tires=Math.max(0,state.tires-amount*.2);
    state.fatigue[state.activeDriver]=Math.min(100,state.fatigue[state.activeDriver]+CREW.find(c=>c.id===state.crew[state.activeDriver])!.stress);
    hooks.log('Kollision im Verkehr.');hooks.say('Aufprall! Abstand halten und den Wagen prüfen.',3);
   }
  }
  state.collisionCooldown=Math.max(state.collisionCooldown,1);
 }
 function separate(a:Actor,b:Actor,axis:'x'|'distance'){
  if(a.fixed&&b.fixed)return;
  if(axis==='x'){
   const sign=a.old.x>b.old.x?1:-1,width=a.half+b.half+BODY_MARGIN+EPS;
   const aIntrusion=Math.max(0,(a.next.x-a.old.x)*-sign),bIntrusion=Math.max(0,(b.next.x-b.old.x)*sign);
   if(a.fixed)b.next.x=a.next.x-sign*width;
   else if(b.fixed)a.next.x=b.next.x+sign*width;
   else if(aIntrusion>bIntrusion)a.next.x=b.next.x+sign*width;
   else if(bIntrusion>aIntrusion)b.next.x=a.next.x-sign*width;
   else if(a===player)b.next.x=a.next.x-sign*width;
   else if(b===player)a.next.x=b.next.x+sign*width;
   else{const middle=(a.next.x+b.next.x)/2;a.next.x=middle+sign*width/2;b.next.x=middle-sign*width/2;}
   if(a===player||b===player)impact(a===player?b:a,a===player?bIntrusion>=aIntrusion:aIntrusion>=bIntrusion);
   return;
  }
  const low=a.old.distance<b.old.distance||(a.old.distance===b.old.distance&&a.id<b.id)?a:b,high=low===a?b:a;
  if(low.fixed){
   if(high===player)impact(low,false);else if(low===player)impact(high,true);
   high.next.distance=low.next.distance+LENGTH+EPS;if(high.car)high.car.speed=0;else state.speed=0;
  }else if(high.fixed){
   if(low===player)impact(high,false);else if(high===player)impact(low,true);
   low.next.distance=high.next.distance-LENGTH-EPS;if(low.car)low.car.speed=0;else state.speed=0;
  }
  else if(low===player||high===player){
   const npc=low===player?high:low,rear=low===npc&&!npc.car!.oncoming;
   impact(npc,rear);
   if(low===player){player.next.distance=high.next.distance-LENGTH-EPS;state.speed=npc.car!.oncoming?0:Math.min(state.speed*.65,npc.car!.speed);}
   else{low.next.distance=player.next.distance-LENGTH-EPS;low.car!.speed=Math.min(low.car!.speed,state.speed);}
  }
  else if(!low.car!.oncoming&&!high.car!.oncoming){low.next.distance=high.next.distance-LENGTH-EPS;low.car!.speed=Math.min(low.car!.speed,high.car!.speed);}
  else if(low.car!.oncoming&&high.car!.oncoming){high.next.distance=low.next.distance+LENGTH+EPS;high.car!.speed=Math.min(low.car!.speed,high.car!.speed);}
  else{const middle=(low.next.distance+high.next.distance)/2;low.next.distance=middle-LENGTH/2-EPS;high.next.distance=middle+LENGTH/2+EPS;low.car!.speed=0;high.car!.speed=0;}
 }
 // Continuous first contact selects the contact normal from immutable poses.
 for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){
  const a=actors[i],b=actors[j];if(a.fixed&&b.fixed)continue;const hit=sweep(a,b);if(!hit)continue;
  const currentZ=Math.abs(a.next.distance-b.next.distance),currentX=Math.abs(a.next.x-b.next.x);
  if(hit.axis==='x'&&currentZ<LENGTH+EPS)separate(a,b,'x');
  else if(hit.axis==='distance'&&currentX<a.half+b.half+BODY_MARGIN){
   // Crossing an entire body in one tick still keeps the previous longitudinal order.
   separate(a,b,'distance');
  }
 }
 // A front correction may close a rear gap. Revisit the common actor set until
 // no movable body remains inside another; damage cooldown never disables this.
 for(let iteration=0;iteration<actors.length*2;iteration++){
  let changed=false;
  for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){
   const a=actors[i],b=actors[j];if(a.fixed&&b.fixed)continue;
   if(Math.abs(a.next.distance-b.next.distance)>=LENGTH-EPS||Math.abs(a.next.x-b.next.x)>=a.half+b.half+BODY_MARGIN-EPS)continue;
   separate(a,b,Math.abs(a.old.distance-b.old.distance)<LENGTH&&Math.abs(a.old.x-b.old.x)>=a.half+b.half+BODY_MARGIN-EPS?'x':'distance');changed=true;
  }
  if(!changed)break;
 }
 state.distance=Math.max(0,player.next.distance);state.x=player.next.x-getRouteOffset(state.distance,state.route);
 for(const actor of actors.slice(1)){
  const car=actor.car!;if(actor.fixed)continue;
  car.distance=actor.next.distance;car.x=actor.next.x-getRouteOffset(car.distance,car.route??'main');
 }
}
function finishRoadTraffic(state:RunState,actors:Actor[],seconds:number):void {
 for(const actor of actors.slice(1)){
  const car=actor.car!;if(actor.fixed)continue;
  const delta=car.distance-state.distance;
  if(car.role==='traffic'&&(delta< -6500||delta>20000)){
   car.distance=state.distance+8000+random(state)*8000;car.x=car.oncoming?(car.id.endsWith('0')?-.75:-.25):.75;car.targetX=car.x;car.passingId=null;
  }
 }
 for(const rival of state.rivals){
  const car=state.traffic.find(c=>c.id===rival.id);if(!car)continue;
  const finish=rivalFinishDistance(rival.id);
  if(car.distance>=finish){car.distance=finish;car.speed=0;}
  rival.distance=car.distance;
  const marker=Math.floor(rival.distance/100000),key=`${rival.id}:stop:${marker}`;
  if(marker>0&&marker<4&&!state.triggered.includes(key)){state.triggered.push(key);rival.stopUntil=state.elapsed+seconds+360+random(state)*540;}
 }
}
const hornTimes=new WeakMap<TrafficCar,number>();
