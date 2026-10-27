import { TIME_SCALE } from './data.ts';

export interface DrivingBody {
  id:string;distance:number;x:number;targetX:number;speed:number;half:number;
}

/** Adapted from Velvet Cruise Race.yieldSafe (src/game/race.ts).
 * Keep its complete swept lane reservation and 1.8-second prediction. Cannonball
 * stores metres/kmh and compresses travel, so relative velocity is converted here.
 */
export function laneChangeIsClear(car:DrivingBody,target:number,others:DrivingBody[],carLength=28):boolean {
  return others.every(other=>{
    if(other.id===car.id)return true;
    if(other.id==='player'){
      const from=car.x-other.x,to=target-other.x;
      const across=from*to<0&&Math.abs(from)>.06;
      const into=across||(Math.abs(to)<car.half+other.half+.06&&Math.abs(to)<Math.abs(from)-.02);
      if(!into)return true;
      const dz=car.distance-other.distance,predicted=dz+(car.speed-other.speed)/3.6*TIME_SCALE*1.8;
      return !(Math.min(dz,predicted)<carLength*3&&Math.max(dz,predicted)>-carLength*2);
    }
    const lo=Math.min(car.x,target)-car.half-.06,hi=Math.max(car.x,target)+car.half+.06;
    const otherLo=Math.min(other.x,other.targetX)-other.half-.06,otherHi=Math.max(other.x,other.targetX)+other.half+.06;
    if(hi<otherLo||lo>otherHi)return true;
    const dz=other.distance-car.distance,predicted=dz+(other.speed-car.speed)/3.6*TIME_SCALE*1.8;
    return Math.min(dz,predicted)>carLength*4||Math.max(dz,predicted)<-carLength*3;
  });
}
