import type { RunState } from '../../src/model.ts';
import { TIME_SCALE } from '../../src/data.ts';
const testLanes=new WeakMap<RunState,number>();
// A deterministic test driver evaluates real right-hand traffic, never removes it.
export function driveTraffic(state: RunState, targetSpeed: number, dt = 1 / 60) {
  const clearance = (lane:number) => {
    let closest=10000;
    for(const car of state.traffic){
      if(car.oncoming||car.role==='police'||Math.abs(car.x-lane)>.2)continue;
      const gap=car.distance-state.distance;
      const plannedSpeed=gap>0?Math.max(state.speed,targetSpeed):Math.min(state.speed,targetSpeed);
      const closing=(plannedSpeed-car.speed)/3.6*TIME_SCALE;
      if(Math.abs(gap)<30)closest=0;
      else if(gap*closing>0)closest=Math.min(closest,Math.abs(gap/closing));
    }
    return closest;
  };
  const current=testLanes.get(state)??.75,other=current===.75?.25:.75;
  const settled=Math.abs(state.x-current)<.08;
  const lane=settled&&clearance(current)<7&&clearance(other)>Math.max(.18,clearance(current)+.08)?other:current;
  testLanes.set(state,lane);
  // Braking distance uses the same accelerated distance clock as the road. A
  // wall-clock-only stopping distance is eight times too short at stage speed.
  let limit=targetSpeed;
  for(const car of state.traffic){
    if(car.oncoming||car.role==='police'||car.distance<=state.distance)continue;
    if(Math.abs(car.x-lane)>.2&&Math.abs(car.x-state.x)>.2)continue;
    const stoppingRoom=Math.max(0,car.distance-state.distance-30);
    limit=Math.min(limit,Math.sqrt(car.speed**2+2*41*3.6*stoppingRoom/TIME_SCALE));
  }
  const gain=Math.min(20,.9/(dt*(.3+state.speed/100)));
  return {throttle:state.speed<limit-.1?1:0,brake:state.speed>limit?1:0,steer:Math.max(-1,Math.min(1,(lane-state.x)*gain))};
}
