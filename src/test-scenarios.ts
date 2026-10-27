import type { RunOptions, RunState, TestScenarioId } from './model.ts';
import { BRANCH, SERVICES, getVehicle } from './data.ts';
import { getRoadSample, nextRoadBend } from './road.ts';
import { createRun, updateRun } from './simulation.ts';

export const TEST_SCENARIOS:readonly {id:TestScenarioId;name:string;description:string}[]=[
  {id:'traffic',name:'Verkehr',description:'Stillstand mit einem folgenden Truck und einem Rennteam hinter dir.'},
  {id:'police',name:'Polizei',description:'Eine sichtbare Kontrolle voraus: vorbeifahren, bremsen und rechts anhalten.'},
  {id:'fork',name:'Abzweigung',description:'Kurz vor der echten Gabelung nach rechts auf die Nebenstraße lenken.'},
  {id:'curves',name:'Kurven',description:'Eine vorbereitete Anfahrt auf die nächste lang gezogene Straßenkurve.'},
  {id:'service',name:'Service',description:'Vor Sundown Gas auf den Vorplatz fahren und im markierten Feld anhalten.'},
];

/** Deliberate local test setup. Subsequent movement uses the normal input path. */
export function createTestRun(id:TestScenarioId,options:RunOptions={}):RunState{
  const scenario=TEST_SCENARIOS.find(item=>item.id===id);
  if(!scenario)throw new Error('Unknown test scenario');
  const state=createRun({...options,seed:options.seed??42});
  let speed=0;
  if(id==='police'){
    const county=state.counties.find(item=>item.police)??state.counties[0];
    // A test seed with no checks still needs its explicitly advertised subject.
    county.police??={...county.policeCandidate};
    state.distance=county.police.trigger-1600;speed=160;
  }else if(id==='fork'){state.distance=BRANCH.start-1200;speed=70;}
  else if(id==='curves'){state.distance=(nextRoadBend(9000)?.start??10200)-1000;speed=80;}
  else if(id==='service'){state.distance=SERVICES[0].distance-3000;speed=70;}
  const car=getVehicle(state.vehicleId);
  state.speed=Math.min(speed,car.maxSpeed);
  state.gear=Math.max(1,car.gearSpeeds.findIndex(limit=>limit>=state.speed*1.05)+1);
  state.rpm=Math.min(6800,900+state.speed/car.gearSpeeds[state.gear-1]*5500);
  state.countyIndex=state.counties.findIndex(county=>state.distance<county.end);
  state.lastSpeedLimit=getRoadSample(state.distance,state.route).speedLimit*1.609344;
  for(const county of state.counties)if(county.police&&county.police.trigger<state.distance)county.police.resolved=true;
  for(const actor of state.traffic)actor.distance+=state.distance;
  for(const rival of state.rivals){
    rival.distance+=state.distance;
    // Prepared late-stage scenes already passed earlier pit markers. Do not
    // invent a fresh roadside stop in the junction on their initialization tick.
    for(let marker=1;marker<=Math.min(3,Math.floor(rival.distance/100000));marker++)state.triggered.push(`${rival.id}:stop:${marker}`);
  }
  if(id==='traffic'){
    const truck=state.traffic.find(actor=>actor.body==='truck'&&!actor.oncoming)!;
    Object.assign(truck,{distance:-320,x:.75,targetX:.75,speed:55,desiredSpeed:55});
    const rival=state.rivals[0],actor=state.traffic.find(item=>item.id===rival.id)!;
    rival.distance=-650;Object.assign(actor,{distance:-650,x:.25,targetX:.25,speed:135,desiredSpeed:135});
  }
  state.log=[{time:0,text:`Testfahrt ${scenario.name}: vorgegebene Startposition, kein Spielstand.`,kind:'info'}];
  // One normal initialization tick creates the physical police actor and its
  // ordinary sighting cue. There is no controller or continuing automation.
  updateRun(state,{throttle:0,brake:0,steer:0},1/60);
  return state;
}
