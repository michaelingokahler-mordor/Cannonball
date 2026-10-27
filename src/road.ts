import type { CountyPlan, RoadSample, RouteChoice } from './model.ts';
import { BRANCH, STAGE_LENGTH } from './data.ts';
export function clamp(value:number,min:number,max:number):number { return Math.max(min,Math.min(max,value)); }
export function seededRandom(seed:number):()=>number {
  let value=(seed>>>0)||0x6d2b79f5;
  return ()=>{value^=value<<13;value^=value>>>17;value^=value<<5;return (value>>>0)/4294967296;};
}
export interface RoadBend { id:string; start:number; apex:number; end:number; direction:'left'|'right' }
const ease=(v:number)=>{const t=clamp(v,0,1);return t*t*(3-2*t);};
function bendPlan(index:number,detour:boolean):RoadBend {
  const period=detour?7400:9000,start=index*period+(detour?900:1200);
  return {id:`${detour?'detour':'main'}-${index}`,start,apex:start+1600,end:start+4000,direction:index%2===0?'left':'right'};
}
function clearOfJunction(bend:RoadBend):boolean {
  return ![[BRANCH.start-800,BRANCH.decision+BRANCH.divergence],[BRANCH.end-BRANCH.rejoin,BRANCH.end+400]]
    .some(([start,end])=>bend.start<end&&bend.end>start);
}
/** The same authored bend supplies the road, steering force and passenger cue. */
export function nextRoadBend(distance:number,route:RouteChoice='main'):RoadBend|null {
  const detour=route==='detour'&&distance>=BRANCH.decision&&distance<BRANCH.end;
  const period=detour?7400:9000;
  for(let index=Math.max(0,Math.floor(distance/period));index<Math.ceil(STAGE_LENGTH/period);index++){
    const bend=bendPlan(index,detour);
    if(bend.end>distance&&bend.start<STAGE_LENGTH&&clearOfJunction(bend)&&(!detour||bend.start<BRANCH.end))return bend;
  }
  return null;
}
function roadCurve(distance:number,detour:boolean):number {
  const bend=bendPlan(Math.floor(distance/(detour?7400:9000)),detour);
  if(!clearOfJunction(bend))return 0;
  const enter=ease((distance-bend.start)/1000),leave=1-ease((distance-(bend.end-1200))/1200);
  return (bend.direction==='right'?1:-1)*(detour?.76:.62)*enter*leave;
}
export function generateCounties(seed:number):CountyPlan[] {
  const random=seededRandom(seed^0x37c62b9);
  const names=['Delaware Valley','Berks County','Susquehanna County','Juniata County','Allegheny County','Beaver County'];
  return names.map((name,i)=>{
    const start=i*STAGE_LENGTH/6,end=(i+1)*STAGE_LENGTH/6;
    const policeRoll=random();
    const kind=random()<.5?'radar' as const:'patrol' as const;
    const trigger=start+(end-start)*(.32+random()*.3);
    const policeCandidate={id:`pa-${i}-${seed>>>0}`,kind,trigger,activated:false,resolved:false};
    return {id:`pa-${i}`,name,start,end,speedLimit:55,rough:i===3,policeRoll,policeCandidate,
      police:policeRoll<.58?{...policeCandidate}:null};
  });
}
export function getRoadSample(distance:number,route:RouteChoice='main'):RoadSample {
  const d=clamp(distance,0,STAGE_LENGTH);
  const detour=route==='detour'&&d>=BRANCH.decision&&d<BRANCH.end;
  let theme:RoadSample['theme']='farmland';
  if(d>=38000&&d<75000)theme='forest';
  else if(d>=75000&&d<103000)theme='town';
  else if(d>=103000&&d<147000)theme='forest';
  else if(d>=147000&&d<174000&&!detour)theme='tunnel';
  else if(d>=174000&&d<225000)theme='ridge';
  else if(d>=225000&&d<275000)theme='forest';
  else if(d>=275000&&d<310000)theme='town';
  if(detour)theme='farmland';
  return {curve:roadCurve(d,detour),
    height:Math.sin(d/27000)*240+Math.sin(d/11300)*90,theme,
    rough:detour||(d>198000&&d<215000),speedLimit:theme==='town'?35:detour?40:55};
}
