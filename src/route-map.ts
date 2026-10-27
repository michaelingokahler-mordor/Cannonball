import { BRANCH, STAGE_LENGTH } from './data.ts';
import type { RouteChoice } from './model.ts';

/** Atlas coordinates are shared by the ink paths, service symbols and live cars. */
export function mapRoutePoint(distance:number,route:RouteChoice='main'):{x:number;y:number} {
  const t=Math.max(0,Math.min(1,distance/STAGE_LENGTH));
  const x=10+t*164,y=42+Math.sin(t*8.2)*6+Math.sin(t*18)*2;
  const u=(distance-BRANCH.decision)/(BRANCH.end-BRANCH.decision);
  return {x,y:y+(route==='detour'&&u>0&&u<1?Math.sin(u*Math.PI)*12:0)};
}
