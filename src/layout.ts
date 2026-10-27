import { BRANCH, SERVICES } from './data.ts';
import type { RouteChoice, ServiceDef } from './model.ts';

// World lateral units: the four-lane main road spans -1..1. Both physics and
// drawing consume this layout; a graphic sign alone must never create an exit.
export interface ServiceLayout {
  stop: ServiceDef; start: number; end: number; parkStart: number; parkEnd: number;
  parkLeft: number; parkRight: number; buildingStart: number; buildingEnd: number;
  buildingLeft: number; buildingRight: number;
}
const smooth=(n:number)=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};

export function detourOffset(distance:number):number {
  if(distance<BRANCH.start||distance>=BRANCH.end)return 0;
  if(distance<=BRANCH.decision)return 1+.05*smooth((distance-BRANCH.start)/(BRANCH.decision-BRANCH.start));
  if(distance<BRANCH.decision+BRANCH.divergence)return 1.05+(BRANCH.separation-1.05)*smooth((distance-BRANCH.decision)/BRANCH.divergence);
  if(distance<BRANCH.end-BRANCH.rejoin)return BRANCH.separation;
  return BRANCH.separation*(1-smooth((distance-(BRANCH.end-BRANCH.rejoin))/BRANCH.rejoin));
}
export function getRouteOffset(distance:number,route:RouteChoice):number {
  return route==='detour'?detourOffset(distance):0;
}
export function getRoadHalfWidth(distance:number,route:RouteChoice):number {
  return route==='detour'&&distance>=BRANCH.start&&distance<BRANCH.end?getDetourHalfWidth(distance):1;
}
export function getDetourHalfWidth(distance:number):number {
  if(distance<BRANCH.start||distance>=BRANCH.end)return 0;
  return distance<BRANCH.decision?.04+.51*smooth((distance-BRANCH.start)/(BRANCH.decision-BRANCH.start)):.55;
}
export function getServiceLayout(stop:ServiceDef):ServiceLayout {
  return {stop,start:stop.distance-2400,end:stop.distance+1800,
    parkStart:stop.distance-420,parkEnd:stop.distance+280,parkLeft:1.45,parkRight:2.12,
    buildingStart:stop.distance+450,buildingEnd:stop.distance+1100,buildingLeft:2.4,buildingRight:3.35};
}
export function serviceAtParking(distance:number,x:number,route:RouteChoice):ServiceDef|null {
  if(route!=='main')return null;
  return SERVICES.find(stop=>{const s=getServiceLayout(stop);return distance>=s.parkStart&&distance<=s.parkEnd&&x>=s.parkLeft&&x<=s.parkRight;})??null;
}
export function serviceOnApproach(distance:number,route:RouteChoice):ServiceDef|null {
  if(route!=='main')return null;
  return SERVICES.find(stop=>distance>=stop.distance-6500&&distance<=getServiceLayout(stop).end)??null;
}
export function isServiceApron(distance:number,x:number,route:RouteChoice):boolean {
  if(route!=='main')return false;
  return SERVICES.some(stop=>{const s=getServiceLayout(stop);return distance>=s.start&&distance<=s.end&&x>=.95&&x<=2.28;});
}
export function buildingAt(distance:number,x:number,route:RouteChoice):ServiceDef|null {
  if(route!=='main')return null;
  return SERVICES.find(stop=>{const s=getServiceLayout(stop);return distance>=s.buildingStart&&distance<=s.buildingEnd&&x>=s.buildingLeft&&x<=s.buildingRight;})??null;
}
export function isDrivable(distance:number,x:number,route:RouteChoice):boolean {
  if(Math.abs(x)<=getRoadHalfWidth(distance,route)+.06)return true;
  if(route==='main'&&distance>=BRANCH.start&&distance<BRANCH.decision+1000&&Math.abs(x-detourOffset(distance))<getDetourHalfWidth(distance)+.06)return true;
  return isServiceApron(distance,x,route);
}
