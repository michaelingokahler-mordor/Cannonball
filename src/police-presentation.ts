import type { RunState, TrafficCar } from './model.ts';
import { getRouteOffset } from './layout.ts';

/** Audio is derived from physical actors, using the real driving-time clock. */
export function trafficSoundLevels(state:RunState|null):{siren:number;horn:number}{
  if(!state||state.status!=='driving')return {siren:0,horn:0};
  const playerX=state.x+getRouteOffset(state.distance,state.route);
  const audible=(car:TrafficCar,range:number)=>{
    if((car.route??'main')!==state.route)return 0;
    const lateral=Math.abs(car.x+getRouteOffset(car.distance,car.route??'main')-playerX);
    if(lateral>1.25)return 0;
    const fraction=Math.max(0,1-Math.abs(car.distance-state.distance)/range);
    return fraction*fraction;
  };
  let siren=0,horn=0;
  for(const car of state.traffic){
    const isOfficer=car.role==='police'&&car.id===`police:${state.police.eventId}`;
    if(isOfficer&&state.police.mode==='pursuit'&&car.siren!==false)siren=Math.max(siren,.11*audible(car,1600));
    const remaining=(car.hornUntil??0)-state.drivingTime;
    // Traffic uses short pulses. A stale/unbounded timestamp must not become a
    // continuous horn, including when a malformed state reaches audio directly.
    if(remaining>0&&remaining<=.5)horn=Math.max(horn,.075*audible(car,800));
  }
  return {siren,horn};
}
