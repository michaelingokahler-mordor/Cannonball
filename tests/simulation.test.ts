import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, updateRun, shiftGear, chooseRoute, enterService, serviceAction, serializeRun, restoreRun, registerViolation, getCurrentCounty, getUpcomingService } from '../src/simulation.ts';
import { SERVICES, STAGE_LENGTH, TIME_SCALE, BRANCH, getVehicle } from '../src/data.ts';
import { getRoadSample } from '../src/road.ts';
import { isDrivable } from '../src/layout.ts';
import { driveTraffic as testDriver } from './helpers/driver.ts';

const idle = { throttle: 0, brake: 0, steer: 0 };
const gas = { throttle: 1, brake: 0, steer: 0 };
function atService(kind: string) {
  const state = createRun({ seed: 42 });
  const stop = SERVICES.find(stop => stop.kind === kind)!;
  assert.ok(stop, `Missing ${kind}`);
  state.distance = stop.distance;
  state.x = 1.75;
  state.speed = 0;
  assert.equal(enterService(state), true);
  return state;
}

test('seed fixes all six county event plans and initial period traffic', () => {
  const a = createRun({ seed: 827 });
  const b = createRun({ seed: 827 });
  assert.deepEqual(a, b);
  assert.equal(a.counties.length, 6);
  assert.equal(a.traffic.filter(car => car.role === 'traffic').length, 20);
  assert.equal(a.rivals.length, 4);
  assert.equal(a.traffic.filter(car => car.role === 'rival').length, 4);
  assert.ok(a.counties.every(county => county.police === null || county.police.activated === false));
  assert.equal(getCurrentCounty(a).id, a.counties[0].id);
});

test('manual first gear never upshifts itself and unsafe downshifts are refused', () => {
  const state = createRun({ vehicleId: 'steinbach' });
  for (let i = 0; i < 2400; i++) updateRun(state, gas, 1 / 60);
  const car = getVehicle(state.vehicleId)!;
  assert.equal(state.gear, 1);
  assert.ok(state.speed <= car.gearSpeeds[0] + 0.01);
  assert.ok(state.rpm > 5000);
  assert.equal(shiftGear(state, 1), true);
  state.speed = car.gearSpeeds[0] + 30;
  assert.equal(shiftGear(state, -1), false);
  assert.equal(state.gear, 2);
});

test('automatic changes ratios and respects its real top speed', () => {
  const state = createRun({ vehicleId: 'hohenfels', seed: 21 });
  for (let i = 0; i < 1800; i++) updateRun(state, testDriver(state,225), 1 / 60);
  const car = getVehicle(state.vehicleId)!;
  assert.ok(state.gear > 1);
  assert.ok(state.gear <= car.gears);
  assert.ok(state.speed <= car.maxSpeed);
  assert.equal(shiftGear(state, 1), false);
});

test('menus freeze resources, clock, traffic and rivals', () => {
  const state = atService('fuel');
  const before = structuredClone(state);
  updateRun(state, gas, 60);
  assert.deepEqual(state, before);
});

test('services charge fixed time and once-per-visit healing; diner rests more', () => {
  const fuel = atService('fuel');
  fuel.fuel = 10; fuel.fatigue = [70, 70];
  const fuelBefore = fuel.elapsed;
  assert.equal(serviceAction(fuel, 'refuel').ok, true);
  const fuelPenalty = fuel.elapsed - fuelBefore;
  assert.equal(fuelPenalty, 7 * 60);
  const once = structuredClone(fuel);
  assert.equal(serviceAction(fuel, 'refuel').ok, false);
  assert.deepEqual(fuel, once);
  assert.equal(serviceAction(fuel, 'repair').ok, false);
  const garage = atService('garage'); garage.condition = 30; garage.fatigue = [70, 70];
  const garageBefore = garage.elapsed;
  assert.equal(serviceAction(garage, 'repair').ok, true);
  const diner = atService('diner'); diner.fatigue = [70, 70];
  const dinerBefore = diner.elapsed;
  assert.equal(serviceAction(diner, 'rest').ok, true);
  assert.ok(fuelPenalty < garage.elapsed - garageBefore);
  assert.ok(garage.elapsed - garageBefore < diner.elapsed - dinerBefore);
  assert.ok(diner.fatigue[0] < fuel.fatigue[0]);
  assert.ok(garage.rivals[0].distance > createRun().rivals[0].distance);
});

test('crew swap changes active fatigue and a passenger recovers partially', () => {
  const state = createRun({ seed: 22 }); state.fatigue = [40, 40];
  for (let i = 0; i < 600; i++) updateRun(state, gas, 1 / 60);
  assert.ok(state.fatigue[0] > 40);
  assert.ok(state.fatigue[1] < 40);
  const stop = SERVICES[0]; state.distance = stop.distance; state.speed = 0;state.x=1.75;
  state.police.mode = 'idle'; state.police.eventId = null;
  assert.equal(enterService(state), true);
  assert.equal(serviceAction(state, 'swap').ok, true);
  assert.equal(state.activeDriver, 1);
});

test('save restores deterministic state exactly without healing or rerolling', () => {
  const state = atService('truckstop');
  state.fuel = 37; state.condition = 63; state.fatigue = [41, 28];
  serviceAction(state, 'refuel');
  const before = structuredClone(state);
  const raw = serializeRun(state);
  assert.equal(typeof raw, 'string');
  assert.deepEqual(state, before);
  const restored = restoreRun(raw!);
  assert.deepEqual(restored, before);
  serviceAction(state, 'leave'); serviceAction(restored!, 'leave');
  for (let i = 0; i < 600; i++) { updateRun(state, gas, 1 / 60); updateRun(restored!, gas, 1 / 60); }
  assert.deepEqual(restored, state);
});

test('unsafe snapshots and corrupt or unknown identifiers are rejected', () => {
  const driving = createRun(); assert.equal(serializeRun(driving), null);
  const state = atService('fuel');
  state.police.mode = 'pursuit'; assert.equal(serializeRun(state), null);
  state.police.mode = 'idle';
  const raw = serializeRun(state)!;
  for (const mutate of [
    (value: any) => { value.vehicleId = 'unknown'; },
    (value: any) => { value.crew[1] = 'unknown'; },
    (value: any) => { value.fuel = -1; },
    (value: any) => { value.distance = null; },
    (value: any) => { value.counties[0].police = { id: 'fake', kind: 'radar', trigger: 10, activated: false, resolved: false }; },
    (value: any) => { value.traffic[0].speed = 'fast'; },
    (value: any) => { value.rng = -1; },
    (value: any) => { value.serviced.push('free-healing'); },
  ]) { const value = JSON.parse(raw); mutate(value); assert.equal(restoreRun(JSON.stringify(value)), null); }
  assert.equal(restoreRun('{bad'), null);
});

test('revisiting a serviced stop or reloading cannot repeat its action', () => {
  const state = atService('fuel'); state.fuel = 20;
  serviceAction(state, 'refuel');
  const restored = restoreRun(serializeRun(state)!)!;
  restored.fuel = 25;
  assert.equal(serviceAction(restored, 'refuel').ok, false);
  serviceAction(restored, 'leave'); restored.speed = 0;
  assert.equal(enterService(restored), false);
  restored.x=.75;updateRun(restored,idle,1/60);restored.x=1.75;
  assert.equal(enterService(restored), true);
  assert.equal(serviceAction(restored, 'refuel').ok, false);
});

test('service entrance requires a nearby slow car and no pursuit', () => {
  const state = createRun();
  assert.ok(getUpcomingService(state));
  assert.equal(enterService(state), false);
  state.distance = SERVICES[0].distance; state.speed = 36;
  assert.equal(enterService(state), false);
  state.speed = 0; state.police.mode = 'pursuit';
  assert.equal(enterService(state), false);
});

test('route decision has a bounded window and detour adds actual travel', () => {
  const main = createRun({ seed: 39 }); const detour = createRun({ seed: 39 });
  assert.equal(chooseRoute(main, 'detour'), false);
  main.distance = detour.distance = BRANCH.decision - 100;
  assert.equal(chooseRoute(detour, 'detour'), true);
  detour.x=1.3;
  main.speed = detour.speed = 100;
  main.gear = detour.gear = 3;
  updateRun(main, idle, 1); updateRun(detour, idle, 1);
  assert.ok(main.distance > detour.distance);
  assert.equal(detour.route, 'detour');
  detour.distance = BRANCH.end + 1;
  assert.equal(chooseRoute(detour, 'main'), false);
});

test('police events trigger once, occupy the road behind and block saving', () => {
  const state = createRun({ seed: 2 });
  const county = state.counties.find(county => county.police)!;
  assert.ok(county);
  state.distance = county.police!.trigger - 1; state.speed = 200; state.gear = 4;
  updateRun(state, gas, 1 / 60);
  assert.equal(state.police.mode, 'pursuit');
  assert.equal(county.police!.activated, true);
  const officer = state.traffic.find(car => car.role === 'police');
  assert.ok(officer);
  assert.ok(Math.abs(state.distance - officer.distance - state.police.gap) < 0.001);
  assert.equal(enterService(state), false);
  assert.equal(serializeRun(state), null);
});

test('violations are idempotent and the third strike defeats border escape', () => {
  const state = createRun();
  assert.equal(registerViolation(state, 'one'), true);
  assert.equal(registerViolation(state, 'one'), false);
  assert.equal(state.violations, 1);
  assert.equal(registerViolation(state, 'two'), true);
  state.distance = STAGE_LENGTH + 1; state.speed = 0; state.gear = 4;
  state.police = { mode: 'pursuit', gap: 60, eventId: 'three', catchProgress: 1.99, cooldown: 0,pursuitTime:30 };
  state.traffic.push({id:'police:three',distance:state.distance-60,x:.75,speed:0,color:'#eee',body:'sedan',oncoming:false,role:'police'});
  updateRun(state, idle, 1 / 60);
  assert.equal(state.violations, 3);
  assert.equal(state.status, 'failed');
});

test('Ohio border ends a surviving pursuit with explicit escape log', () => {
  const state = createRun(); state.distance = STAGE_LENGTH - 1; state.speed = 200; state.gear = 4;
  state.police = { mode: 'pursuit', gap: 500, eventId: 'border', catchProgress: 0, cooldown: 0,pursuitTime:0 };
  updateRun(state, idle, 1 / 60);
  assert.equal(state.status, 'finished');
  assert.equal(state.police.mode, 'escaped');
  assert.equal(state.escapes,1);
  assert.equal(state.traffic.some(car => car.role === 'police'), false);
  assert.ok(state.log.some(entry => entry.kind === 'police' && /Ohio/.test(entry.text)));
});

test('traffic collision damages the car and has a contact cooldown', () => {
  const state = createRun({ seed: 7 }); state.speed = 120; state.gear = 3;
  state.traffic[0] = { ...state.traffic[0], distance: 2, x: state.x, speed: 0, oncoming: false };
  const condition = state.condition;
  updateRun(state, idle, 1 / 60);
  assert.ok(state.condition < condition - 1);
  const damaged = state.condition;
  updateRun(state, idle, 1 / 60);
  assert.ok(state.condition > damaged - 1);
});

test('depleted resources fail with an explanation', () => {
  for (const resource of ['fuel', 'condition', 'fatigue'] as const) {
    const state = createRun();
    if (resource === 'fatigue') state.fatigue[0] = 100; else state[resource] = 0;
    updateRun(state, gas, 1 / 60);
    assert.equal(state.status, 'failed'); assert.ok(state.failureReason);
  }
});

test('theoretical fastest stage is at least ten real minutes', () => {
  const state = createRun(); const car = getVehicle(state.vehicleId)!;
  assert.ok(STAGE_LENGTH / (car.maxSpeed / 3.6 * TIME_SCALE) >= 600);
});

test('both seeded clean journeys finish deterministically after more than ten real minutes', () => {
  const a = createRun({ seed: 42, vehicleId: 'hohenfels' });
  const b = createRun({ seed: 42, vehicleId: 'hohenfels' });
  for (let step = 0; step < 20000 && a.status === 'driving'; step++) {
    const limit = a.distance >= 75000 && a.distance < 103000 || a.distance >= 275000 && a.distance < 310000 ? 53 : 85;
    const input = testDriver(a,limit,0.25);
    updateRun(a, input, 0.25); updateRun(b, input, 0.25);
  }
  assert.equal(a.status, 'finished', a.failureReason ?? 'Did not finish');
  assert.ok(a.drivingTime >= 600);
  assert.equal(a.distance, STAGE_LENGTH);
  assert.ok(a.fuel > 0);
  assert.deepEqual(a, b);
});

test('a rival is a physical road car and can collide', () => {
  const state = createRun(); state.speed = 120; state.gear = 3;
  const rival = state.rivals[0]; rival.distance = 2; rival.speed = 0;
  const visible = state.traffic.find(car => car.id === rival.id)!;
  visible.distance = 2; visible.x = state.x; visible.speed = 0;
  updateRun(state, idle, 1 / 60);
  assert.ok(state.condition < 99);
});

test('navigator gives an earlier service announcement and mechanics shorten garage time', () => {
  const navigator = createRun({ crew: ['jack', 'rose'] });
  const other = createRun({ crew: ['jack', 'hank'] });
  navigator.distance = other.distance = SERVICES[0].distance - 4500;
  updateRun(navigator, idle, 1 / 60); updateRun(other, idle, 1 / 60);
  assert.ok(navigator.comment?.text.includes(SERVICES[0].name));
  assert.equal(other.comment, null);
  const mechanic = createRun({ crew: ['eddie', 'rose'] });
  mechanic.distance = SERVICES.find(stop => stop.kind === 'garage')!.distance;
  mechanic.x=1.75;
  assert.equal(enterService(mechanic), true);
  const ordinary = atService('garage');
  serviceAction(mechanic, 'repair'); serviceAction(ordinary, 'repair');
  assert.ok(mechanic.elapsed < ordinary.elapsed);
});

test('save validation rejects inconsistent counties, action availability and impossible timers', () => {
  const raw = serializeRun(atService('fuel'))!;
  for (const mutate of [
    (value: any) => { value.countyIndex = 5; },
    (value: any) => { value.serviced.push(`${SERVICES[0].id}:rest`); },
    (value: any) => { value.elapsed += 20; },
    (value: any) => { value.police.catchProgress = 2; },
    (value: any) => { value.extra = 'corruption'; },
  ]) { const value = JSON.parse(raw); mutate(value); assert.equal(restoreRun(JSON.stringify(value)), null); }
});

test('a fast manual stage with two physical service stops fits ten-to-fifteen minute driving', context => {
  const state=createRun({seed:42});
  const planned=SERVICES.filter(stop=>['garage','truckstop'].includes(stop.kind));
  const visited=new Set<string>();
  for(let step=0;step<54000&&(state.status==='driving'||state.status==='service');step++){
    if(state.status==='service'){
      const stop=planned.find(stop=>stop.id===state.serviceId)!;assert.ok(stop);
      visited.add(stop.id);assert.equal(serviceAction(state,stop.kind==='truckstop'?'full':'refuel').ok,true);
      assert.ok(serializeRun(state));serviceAction(state,'leave');
    }
    const stop=planned.find(stop=>!visited.has(stop.id));
    const approach=!!stop&&stop.distance-state.distance<6500&&stop.distance>state.distance-300;
    if(state.speed>=getVehicle(state.vehicleId).gearSpeeds[state.gear-1]*.94)shiftGear(state,1);
    const checkpoint=state.counties.find(county=>county.police&&!county.police.activated&&!county.police.resolved&&county.police.trigger>=state.distance)?.police;
    const posted=checkpoint?getRoadSample(checkpoint.trigger).speedLimit*1.609344:255;
    const slowing=Math.max(0,state.speed**2-posted**2)*TIME_SCALE/(2*40*3.6)+550;
    let target=checkpoint&&checkpoint.trigger-state.distance<slowing?posted:255;
    if(approach)target=Math.min(target,Math.sqrt(2*40*3.6*Math.max(0,stop!.distance-100-state.distance-80)/TIME_SCALE));
    const input=testDriver(state,target);
    if(approach&&state.distance>=stop!.distance-2350){
      const gain=Math.min(20,.9/((1/60)*(.3+state.speed/100)));input.steer=Math.max(-1,Math.min(1,(1.75-state.x)*gain));
    }
    updateRun(state,input,1/60);
    assert.ok(state.x>0&&isDrivable(state.distance,state.x,state.route),`Left the paved carriageway at ${state.distance}m / x${state.x}`);
  }
  assert.equal(state.status,'finished',`${state.failureReason??'Did not finish'} at ${state.distance} / ${state.drivingTime}s; ${JSON.stringify(state.log.slice(-8))}`);
  assert.equal(visited.size,2);assert.ok(state.drivingTime>=600&&state.drivingTime<=900,`${state.drivingTime}s`);
  assert.equal(state.violations,0);assert.ok(state.fuel>0);
  context.diagnostic(JSON.stringify({drivingSeconds:state.drivingTime,virtualSeconds:state.elapsed,fuel:state.fuel,condition:state.condition,collisions:state.log.filter(entry=>entry.text==='Kollision im Verkehr.').length,services:[...visited]}));
});

test('detour bypasses its pre-generated police event without rerolling the county', () => {
  const state = createRun({ seed: 42 });
  const county = state.counties.find(county => county.police && county.police.trigger > BRANCH.decision && county.police.trigger < BRANCH.end)!;
  const plan = structuredClone(county.police)!;
  state.distance = BRANCH.start;
  assert.equal(chooseRoute(state, 'detour'), true);
  state.distance = plan.trigger - 1; state.route='detour';state.x=.2;state.speed = 220; state.gear = 4;
  updateRun(state, gas, 1 / 60);
  assert.notEqual(state.police.mode, 'pursuit');
  assert.equal(county.police!.resolved, true);
  assert.equal(county.police!.id, plan.id);
  assert.equal(county.police!.trigger, plan.trigger);
  state.distance = plan.trigger - 1;
  updateRun(state, gas, 1 / 60);
  assert.notEqual(state.police.mode, 'pursuit');
});

test('yielding confirms only one violation and repeated frames do not charge it again', () => {
  const state = createRun({ seed: 42 });
  const event = state.counties[0].police!;
  state.distance = event.trigger - 1; state.speed = 180; state.gear = 3;
  updateRun(state, gas, 1 / 60);
  assert.equal(state.police.mode, 'pursuit');
  state.speed = 0;
  updateRun(state, idle, 0.5);
  assert.equal(state.violations,0);
  for(let i=0;i<600&&state.violations===0;i++)updateRun(state,idle,1/60);
  assert.equal(state.violations, 1);
  assert.equal(state.police.mode, 'caught');
  const penalty = state.timePenalties;
  updateRun(state, idle, 1);
  assert.equal(state.violations, 1);
  assert.equal(state.timePenalties, penalty);
});

test('a new run starts centered in the right-hand travel lane', () => {
  const state = createRun();
  assert.ok(state.x >= 0.65 && state.x <= 0.85, `Initial lateral position ${state.x}`);
});

test('period traffic occupies the actual four lane centers used by road projection', () => {
  const state=createRun({seed:42});
  for(const car of state.traffic){
    assert.ok((car.oncoming?[-.75,-.25]:[.25,.75]).includes(car.x), `Invalid road lane ${car.x}`);
  }
});

test('the starting grid lets a stationary new player read the controls without being rammed from behind', () => {
  const state=createRun({seed:42});
  for(let frame=0;frame<600;frame++)updateRun(state,idle,1/60);
  assert.equal(state.condition,100);
  assert.equal(state.log.some(entry=>entry.text==='Kollision im Verkehr.'),false);
});
