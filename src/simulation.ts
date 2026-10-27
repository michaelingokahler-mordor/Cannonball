import type { ActionResult, CountyPlan, InputState, PoliceEvent, RouteChoice, RunOptions, RunState, ServiceAction, ServiceDef, TrafficCar } from './model.ts';
import { BRANCH, CREW, SERVICES, STAGE_LENGTH, TIME_SCALE, VEHICLES } from './data.ts';
import { clamp, generateCounties, getRoadSample } from './road.ts';
import { canReplaceComment, makePassengerComment, nextNavigationCue } from './comments.ts';
import { buildingAt, detourOffset, getRouteOffset, getServiceLayout, isDrivable, serviceAtParking } from './layout.ts';
import { rememberTrafficPlayerPose, resolveTrafficAfterPolice, rivalFinishDistance, rivalPolicy, updateRoadTraffic } from './traffic.ts';
const ACTIONS: ServiceAction[] = ['refuel', 'repair', 'rest', 'full', 'swap', 'leave'];
const OLD_RUN_KEYS = 'version stageId seed rng status vehicleId crew activeDriver distance x speed gear rpm fuel condition tires fatigue elapsed drivingTime countyIndex counties traffic rivals police violations confirmedEvents timePenalties log triggered route routeChoice serviceId serviced comment collisionCooldown lastSpeedLimit failureReason'.split(' ').sort();
const RUN_KEYS = [...OLD_RUN_KEYS,'escapes','serviceExitBlock'].sort();
const COLORS = ['#c5ad73', '#7a9066', '#b66445', '#d4d0b7', '#58758c', '#a39380'];
const vehicle = (state: RunState) => VEHICLES.find(car => car.id === state.vehicleId)!;
const driver = (state: RunState) => CREW.find(person => person.id === state.crew[state.activeDriver])!;
const random = (state: RunState) => {
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return state.rng / 4294967296;
};
const log = (state: RunState, text: string, kind: 'info' | 'police' | 'service' | 'milestone' = 'info') => {
  state.log.push({ time: state.elapsed, text, kind });
  if (state.log.length > 120) state.log.shift();
};
function say(state: RunState, text: string, priority = 1) {
  if (canReplaceComment(state.comment, state.drivingTime, priority)) {
    const passenger = CREW.find(person => person.id === state.crew[1 - state.activeDriver])!;
    state.comment = makePassengerComment(passenger, text, state.drivingTime, priority);
  }
}
export function createRun(options: RunOptions = {}): RunState {
  const vehicleId = options.vehicleId ?? 'steinbach';
  const crew = options.crew ?? ['jack', 'rose'];
  if (!VEHICLES.some(car => car.id === vehicleId)) throw new Error('Unknown vehicle');
  if (!Array.isArray(crew) || crew.length !== 2 || crew[0] === crew[1] || crew.some(id => !CREW.some(person => person.id === id))) throw new Error('Choose two different crew members');
  const seed = options.seed === undefined ? 1976 : options.seed;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Invalid seed');
  const state: RunState = {
    version: 2, stageId: 'pa', seed, rng: seed >>> 0, status: 'driving', vehicleId, crew: [...crew] as [string, string], activeDriver: 0,
    distance: 0, x: 0.75, speed: 0, gear: 1, rpm: 900, fuel: VEHICLES.find(car => car.id === vehicleId)!.tank,
    condition: 100, tires: 100, fatigue: [0, 0], elapsed: 0, drivingTime: 0, countyIndex: 0, counties: generateCounties(seed),
    traffic: [], rivals: [], police: { mode: 'idle', gap: 0, eventId: null, catchProgress: 0, cooldown: 0, pursuitTime: 0 },
    violations: 0, confirmedEvents: [], timePenalties: 0, log: [], triggered: [], route: 'main', routeChoice: 'main',
    serviceId: null, serviced: [], comment: null, collisionCooldown: 0, lastSpeedLimit: 0, failureReason: null, escapes: 0, serviceExitBlock: null,
  };
  for (let i = 0; i < 20; i++) {
    const oncoming = i % 4 === 0;
    const distance=600+i*620+random(state)*350,body=i%7===0?'truck':i%5===0?'van':'sedan';
    const speed=body==='truck'?55+random(state)*15:60+random(state)*25;
    const x=oncoming?(i%8===0?-.75:-.25):.75;
    state.traffic.push({ id: `traffic-${i}`, distance, x, targetX:x, speed, desiredSpeed:speed, condition:100,route:'main',
      color: COLORS[i % COLORS.length], body, oncoming, role: 'traffic' });
  }
  ['Red Arrow', 'Midnight Express', 'Long Shot', 'Blue Streak'].forEach((name, i) => {
    const rival = { id: `rival-${i}`, name, color: ['#a63632', '#424550', '#c2a242', '#477d99'][i],
      distance: [-1200, -300, 900, 1900][i], speed: 128 + random(state) * 26, stopUntil: 0 };
    state.rivals.push(rival);
    // Teams arriving from behind use the passing lane, leaving the starting car room.
    const x=rival.distance<0?.25:.75;
    state.traffic.push({ id: rival.id, distance: rival.distance, x,targetX:x,speed: rival.speed,desiredSpeed:rival.speed,condition:100,route:'main', color: rival.color, body: 'sports', oncoming: false, role: 'rival' });
  });
  state.lastSpeedLimit = getRoadSample(0).speedLimit * 1.609344;
  log(state, 'Pennsylvania: 360 km bis zur Grenze von Ohio.', 'milestone');
  return state;
}
export function getCurrentCounty(state: RunState): CountyPlan {
  const index = state.counties.findIndex(county => state.distance < county.end);
  return state.counties[index < 0 ? state.counties.length - 1 : index];
}
export function getUpcomingService(state: RunState): ServiceDef | null {
  return SERVICES.find(stop => stop.distance >= state.distance - 2500) ?? null;
}
export function shiftGear(state: RunState, direction: number): boolean {
  const car = vehicle(state);
  if (state.status !== 'driving' || car.transmission !== 'manual' || !Number.isFinite(direction) || direction === 0) return false;
  const next = state.gear + Math.sign(direction);
  if (next < 1 || next > car.gears || (direction < 0 && state.speed > car.gearSpeeds[next - 1] * 0.94)) return false;
  state.gear = next;
  state.rpm = engineRpm(state);
  return true;
}
export function chooseRoute(state: RunState, route: RouteChoice): boolean {
  if (state.status !== 'driving' || !['main', 'detour'].includes(route) || state.distance < BRANCH.start || state.distance > BRANCH.decision) return false;
  state.routeChoice = route;
  say(state, route === 'detour' ? 'Für die Nebenstraße am Abzweig rechts halten.' : 'Für die Hauptstraße links am Abzweig bleiben.');
  return true;
}
function engineRpm(state: RunState) {
  const car = vehicle(state);
  return clamp(900 + state.speed / car.gearSpeeds[state.gear - 1] * 5500, 800, 6800);
}
function progressFactor(state: RunState) {
  return state.route === 'detour' && state.distance >= BRANCH.decision && state.distance < BRANCH.end ? BRANCH.progressFactor : 1;
}
function moveRivals(state: RunState, virtualSeconds: number) {
  for (const rival of state.rivals) {
    const heldUntil=Math.max(rival.stopUntil,rival.policeStopUntil??0);
    const drivingSeconds = (rival.violations??0)>=3?0:Math.max(0, state.elapsed + virtualSeconds - Math.max(state.elapsed, heldUntil));
    const pace=Math.min(rival.speed,rivalPolicy(rival.id).cruise);
    rival.distance = Math.min(rivalFinishDistance(rival.id), rival.distance + pace / 3.6 * drivingSeconds);
    const marker = Math.floor(rival.distance / 100000);
    const key = `${rival.id}:stop:${marker}`;
    if (marker > 0 && marker < 4 && !state.triggered.includes(key)) {
      state.triggered.push(key);
      rival.stopUntil = state.elapsed + virtualSeconds + 360 + random(state) * 540;
    }
    const visible = state.traffic.find(car => car.id === rival.id)!;
    visible.distance = rival.distance;
    visible.speed = rival.distance>=rivalFinishDistance(rival.id)||(rival.violations??0)>=3||heldUntil>state.elapsed+virtualSeconds?0:pace;
  }
}
function advancePenalty(state: RunState, seconds: number) {
  moveRivals(state, seconds);
  state.elapsed += seconds;
  state.timePenalties += seconds;
}
function eventFor(state: RunState, id: string | null): PoliceEvent | null {
  return state.counties.find(county => county.police?.id === id)?.police ?? null;
}
function promoteChecks(state:RunState) {
  const chance=Math.min(.9,.58+state.escapes*.1);
  for(const county of state.counties) if(county.start>state.distance&&!county.police&&county.policeRoll<chance) county.police={...county.policeCandidate};
}
function escape(state: RunState, border = false) {
  const event=eventFor(state,state.police.eventId);
  if(event)event.resolved=true;
  if(state.police.mode==='pursuit'){state.escapes++;promoteChecks(state);}
  state.police.mode='escaped';state.police.catchProgress=0;state.police.cooldown=3;
  for(const car of state.traffic)if(car.role==='police')car.siren=false;
  log(state,border?'Grenze nach Ohio: Die Verfolgung ist abgeschüttelt.':'Die Polizei ist abgeschüttelt.','police');
  say(state,border?'Ohio! Die Polizei muss umkehren.':'Wir sind sie los. Später wird genauer kontrolliert.',3);
}
export function registerViolation(state: RunState, eventId: string): boolean {
  if(typeof eventId!=='string'||!eventId||state.confirmedEvents.includes(eventId)||state.status==='failed'||state.status==='finished')return false;
  state.confirmedEvents.push(eventId);state.violations=state.confirmedEvents.length;
  const event=eventFor(state,eventId);if(event){event.activated=true;event.resolved=true;}
  log(state,`Verstoß ${state.violations}/3 bestätigt.`,'police');
  if(state.violations>=3)fail(state,'Drei bestätigte Verkehrsverstöße. Das Rennen ist vorbei.');
  return true;
}
const worldX=(distance:number,x:number,route:RouteChoice='main')=>x+getRouteOffset(distance,route);
function approach(value:number,target:number,amount:number){return value<target?Math.min(target,value+amount):Math.max(target,value-amount);}
function observeRivals(state:RunState,officer:TrafficCar,event:PoliceEvent){
  for(const rival of state.rivals){
    const car=state.traffic.find(actor=>actor.id===rival.id);
    const key=`police-rival:${event.id}:${rival.id}`;
    if(!car||state.triggered.includes(key)||(car.route??'main')!==(officer.route??'main')||Math.abs(car.distance-officer.distance)>450)continue;
    if(Math.abs(worldX(car.distance,car.x,car.route)-worldX(officer.distance,officer.x,officer.route))>1.5)continue;
    const limit=getRoadSample(car.distance,car.route??'main').speedLimit*1.609344;
    if(car.speed<=limit+12&&(car.condition??100)>=35)continue;
    state.triggered.push(key);rival.violations=(rival.violations??0)+1;
    rival.policeStopUntil=Math.max(rival.policeStopUntil??0,state.elapsed+8*60);
    log(state,`${rival.name}: Polizeikontrolle und acht Minuten Zeitverlust.`,'police');
  }
}
function policeMeetingArea(state:RunState):boolean{
  if(buildingAt(state.distance,state.x,state.route))return false;
  // The right carriageway and its adjoining shoulder/forecourt are the meeting
  // area. The opposing carriageway and distant fields are never ticket sites.
  // On the narrower detour only its actual drivable edge is a safe meeting area.
  return state.route==='detour'?isDrivable(state.distance,state.x,state.route):state.x>=0&&state.x<=2.18;
}
function updatePolice(state:RunState,previousDistance:number,dt:number){
  let officer=state.traffic.find(car=>car.role==='police');
  let event=eventFor(state,state.police.eventId);
  if(officer&&state.police.mode!=='watching'&&state.police.mode!=='pursuit'){
    officer.siren=false;
    state.police.cooldown=Math.max(0,state.police.cooldown-dt);
    if(state.police.cooldown===0){
      state.police.mode='departing';officer.speed=approach(officer.speed,80,15*dt);
      officer.distance+=officer.speed/3.6*dt*TIME_SCALE;
      officer.x=approach(officer.x,.75,dt*.35);
    }
    state.police.gap=state.distance-officer.distance;
    if(Math.abs(state.police.gap)>6500){
      state.traffic=state.traffic.filter(car=>car!==officer);officer=undefined;
      state.police={mode:'idle',gap:0,eventId:null,catchProgress:0,cooldown:0,pursuitTime:0};
    }
  }
  if(!officer&&state.police.mode!=='pursuit'){
    const upcoming=state.counties.find(county=>county.police&&!county.police.resolved&&!county.police.activated&&county.police.trigger>=state.distance-100&&county.police.trigger-state.distance<=6000);
    event=upcoming?.police??null;
    if(event){
      const patrol=event.kind==='patrol',x=patrol?.75:1.18,speed=patrol?80:0;
      // The nominal checkpoint is the observation window. The parked car waits
      // before it, so a detected driver has passed the officer before stopping.
      const distance=patrol?Math.max(state.distance-250,event.trigger-4000):event.trigger-500;
      officer={id:`police:${event.id}`,distance,x,targetX:x,speed,desiredSpeed:speed,condition:100,route:'main',color:'#e1e0d1',body:'sedan',oncoming:false,role:'police',siren:false};
      state.traffic.push(officer);
      state.police={mode:'watching',gap:state.distance-officer.distance,eventId:event.id,catchProgress:0,cooldown:0,pursuitTime:0};
    }else if(state.police.mode!=='idle')state.police={mode:'idle',gap:0,eventId:null,catchProgress:0,cooldown:0,pursuitTime:0};
  }
  if(state.police.mode==='watching'&&officer&&event){
    if(event.kind==='patrol'){
      const limit=getRoadSample(officer.distance,officer.route??'main').speedLimit*1.609344;
      officer.speed=approach(officer.speed,Math.min(80,limit),25*dt);
      officer.distance+=officer.speed/3.6*dt*TIME_SCALE;
    }
    observeRivals(state,officer,event);
    const delta=event.trigger-state.distance;
    const detour=state.route==='detour'&&event.trigger>=BRANCH.decision&&event.trigger<BRANCH.end;
    if(delta<2200&&!state.triggered.includes(`police-sighting:${event.id}`)&&!detour){
      state.triggered.push(`police-sighting:${event.id}`);say(state,event.kind==='patrol'?'Streife vor uns. Tempolimit beachten.':'Polizei am Straßenrand. Tempolimit beachten.',2);
    }
    if(detour&&state.distance>=event.trigger||officer.distance-state.distance>6500){event.resolved=true;state.police.mode='departing';}
    const gap=state.distance-officer.distance;
    const observing=event.kind==='radar'?delta<=400&&delta>=-100:gap>=60&&gap<=500;
    const sameRoute=state.route===(officer.route??'main');
    if(state.police.mode==='watching'&&!detour&&sameRoute&&observing&&(state.speed>getRoadSample(officer.distance,officer.route??'main').speedLimit*1.609344+12||state.condition<35)){
      event.activated=true;state.police.mode='pursuit';state.police.pursuitTime=0;state.police.catchProgress=0;
      log(state,`${event.kind==='radar'?'Radar':'Streife'}: Der Wagen setzt zur Verfolgung an.`,'police');
      say(state,'Polizei! Abstand gewinnen oder rechts sicher anhalten.',4);
    }else if(event.kind==='radar'&&previousDistance<=event.trigger&&state.distance>=event.trigger||event.kind==='patrol'&&gap>600){event.resolved=true;state.police.mode='departing';}
    state.police.gap=state.distance-officer.distance;
  }
  if(state.police.mode!=='pursuit'||!officer)return;
  state.police.pursuitTime+=dt;
  const officerPreviousDistance=officer.distance;
  const playerWorldX=worldX(state.distance,state.x,state.route);
  const gap=state.distance-officer.distance,room=Math.max(0,gap-60);
  const chaseSpeed=Math.min(252,Math.max(215,state.speed-12));
  const safeSpeed=Math.sqrt(state.speed**2+2*75*3.6*room/TIME_SCALE);
  const targetSpeed=gap>=45?Math.min(chaseSpeed,safeSpeed):state.speed<=3?0:Math.min(chaseSpeed,state.speed*.8);
  officer.speed=approach(officer.speed,targetSpeed,(officer.speed>targetSpeed?90:70)*dt);
  officer.oncoming=false;
  const next=officer.distance+officer.speed/3.6*dt*TIME_SCALE;
  // Legacy snapshots may already put an officer ahead. It stops in place and
  // attends only at close range; it never drives backwards down the highway.
  officer.distance=gap>=60?Math.min(next,state.distance-60):next;
  if(officer.distance===state.distance-60&&state.speed<=.1)officer.speed=0;
  if((officer.route??'main')==='main'&&officerPreviousDistance<BRANCH.decision&&officer.distance>=BRANCH.decision&&state.route==='detour'&&officer.x>1.05){
    officer.route='detour';officer.x-=detourOffset(officer.distance);
  }
  if(officer.route==='detour'&&officer.distance>=BRANCH.end){officer.x+=detourOffset(officer.distance);officer.route='main';}
  const localPlayerX=playerWorldX-getRouteOffset(officer.distance,officer.route??'main');
  const ramp=officer.route!=='detour'&&state.route==='detour'&&officer.distance>=BRANCH.start&&officer.distance<BRANCH.decision;
  const meeting=policeMeetingArea(state);
  const wantedX=state.speed<=3?meeting?clamp(localPlayerX,officer.route==='detour'?-.65:0,officer.route==='detour'?.65:2.18):officer.route==='detour'?clamp(officer.x,-.55,.55):1.18:ramp?1.3:.25;
  const targetX=isDrivable(officer.distance,wantedX,officer.route??'main')||Math.abs(wantedX)<=1.25?wantedX:1.18;
  const nextX=approach(officer.x,targetX,dt*.75);
  if(!buildingAt(officer.distance,nextX,officer.route??'main'))officer.x=nextX;
  state.police.gap=state.distance-officer.distance;
  const lateralGap=Math.abs(playerWorldX-worldX(officer.distance,officer.x,officer.route));
  // During pursuit, cooldown counts continuous physical loss of sight. After
  // pursuit it resumes its ordinary departure delay.
  state.police.cooldown=lateralGap>1.25?state.police.cooldown+dt:0;
  officer.siren=state.route===(officer.route??'main')&&lateralGap<=1.25;
  // New approaches stop at 60m. Existing snapshots may already have an officer
  // stopped closer or ahead; attendance is still possible without reversing.
  const attendingRange=Math.abs(state.police.gap)<=100;
  // An officer parked close behind may walk across its own carriageway/shoulder
  // to the stopped driver when another vehicle blocks a final lateral move.
  const reachable=meeting&&state.route===(officer.route??'main')&&lateralGap<=1.05;
  if(state.speed<=.1&&attendingRange&&reachable&&officer.speed<=.1)state.police.catchProgress+=dt;
  else state.police.catchProgress=0;
  if(state.police.catchProgress>=2){
    registerViolation(state,state.police.eventId!);state.police.mode='caught';state.police.cooldown=5;state.police.catchProgress=0;
    officer.siren=false;
    if(state.status!=='failed'){advancePenalty(state,8*60);state.speed=0;say(state,'Strafzettel bezahlt. Beim dritten endet die Fahrt.',5);}
    return;
  }
  if(state.police.pursuitTime>=30-1e-6&&(state.police.gap>1800||state.police.cooldown>=5||(state.police.pursuitTime>=60-1e-6&&state.police.gap>700)))escape(state);
}
function fail(state: RunState, reason: string) {
  state.status = 'failed'; state.failureReason = reason; state.speed = 0;
  log(state, reason, 'milestone'); say(state, reason, 5);
}
function checkResources(state: RunState) {
  if (state.fuel <= 0) fail(state, 'Der Tank ist leer. Die Fahrt endet am Straßenrand.');
  else if (state.condition <= 0) fail(state, 'Motorschaden. Der Wagen kann nicht weiterfahren.');
  else if (state.fatigue[state.activeDriver] >= 100) fail(state, 'Am Steuer eingeschlafen. Die Fahrt ist vorbei.');
  if (state.status === 'failed') return;
  const alerts: [string, boolean, string][] = [
    ['fuel-warning', state.fuel < vehicle(state).tank * 0.18, 'Der Tank wird knapp. Wir brauchen eine Tankstelle.'],
    ['damage-warning', state.condition < 30, 'Der Wagen braucht dringend eine Werkstatt.'],
    [`fatigue-warning:${state.activeDriver}`, state.fatigue[state.activeDriver] >= 75, 'Du bist müde. Lass uns anhalten und wechseln.'],
    ['tires-warning', state.tires < 30, 'Die Reifen verlieren Grip. Langsamer bis zur Werkstatt.'],
  ];
  for (const [key, active, text] of alerts) if (active && !state.triggered.includes(key)) { state.triggered.push(key); say(state, text, 3); log(state, text); }
}
function navigationHints(state: RunState) {
  const passenger = CREW.find(person => person.id === state.crew[1 - state.activeDriver])!;
  const cue = nextNavigationCue(state, passenger);
  if (!cue) return;
  state.triggered.push(cue.id);
  say(state, cue.text, cue.priority);
}
function tick(state: RunState, input: InputState, dt: number) {
  checkResources(state); if (state.status !== 'driving') return;
  const car = vehicle(state), person = driver(state), virtualSeconds = dt * TIME_SCALE;
  const throttle = clamp(Number.isFinite(input.throttle) ? input.throttle : 0, 0, 1);
  const brake = clamp(Number.isFinite(input.brake) ? input.brake : 0, 0, 1);
  const steer = clamp(Number.isFinite(input.steer) ? input.steer : 0, -1, 1);
  rememberTrafficPlayerPose(state);
  const previousDistance = state.distance;
  const road = getRoadSample(state.distance, state.route);
  if (car.transmission === 'automatic') {
    while (state.gear < car.gears && state.speed > car.gearSpeeds[state.gear - 1] * 0.88) state.gear++;
    while (state.gear > 1 && state.speed < car.gearSpeeds[state.gear - 2] * 0.57) state.gear--;
  }
  const fatigue = state.fatigue[state.activeDriver];
  const power = car.acceleration * person.acceleration * (0.7 + state.condition / 333) * (state.gear === 1 ? 1 : 0.82);
  const drag = 0.38 + (state.speed / car.maxSpeed) ** 2 * 1.7;
  state.speed = clamp(state.speed + (throttle * power - brake * 42 - drag) * dt, 0, Math.min(car.maxSpeed, car.gearSpeeds[state.gear - 1]));
  state.rpm = engineRpm(state);
  const grip = car.handling * person.handling * (0.5 + state.tires / 200) * (1 - fatigue / 260);
  const previousX=state.x;
  state.x = clamp(state.x + steer * dt * (0.3 + state.speed / 100) * grip - road.curve * (state.speed / car.maxSpeed) ** 2 * dt * 0.12, -1.5, 3.5);
  const physicalDistance = state.speed / 3.6 * virtualSeconds;
  state.distance += physicalDistance * progressFactor(state);
  if(previousDistance<BRANCH.decision&&state.distance>=BRANCH.decision){
    if(state.x>1.05){state.route='detour';state.routeChoice='detour';state.x-=detourOffset(state.distance);}
    else{state.route='main';state.routeChoice='main';}
  }
  if(state.route==='detour'&&state.distance>=BRANCH.end){state.x+=detourOffset(state.distance);state.route='main';}
  const km = physicalDistance / 1000;
  const consumption = car.consumption * person.fuel * (0.75 + 0.7 * (state.speed / 150) ** 2);
  state.fuel = Math.max(0, state.fuel - km * consumption / 100 - (state.speed < 5 ? virtualSeconds * 0.00015 : 0));
  const rough = road.rough || getCurrentCounty(state).rough;
  const wear = km * car.wear * (rough ? 0.035 : 0.015) * (state.speed > 210 ? 1.8 : 1);
  state.condition = Math.max(0, state.condition - wear);
  state.tires = Math.max(0, state.tires - km * (rough ? 0.045 : 0.022));
  state.fatigue[state.activeDriver] = clamp(fatigue + virtualSeconds / 3600 * 14 * car.fatigue * person.fatigue * (state.police.mode === 'pursuit' ? person.stress * 1.3 : 1), 0, 100);
  const passenger = (1 - state.activeDriver) as 0 | 1;
  state.fatigue[passenger] = Math.max(0, state.fatigue[passenger] - virtualSeconds / 3600 * 6);
  if (!isDrivable(state.distance,state.x,state.route) && state.speed > 20) {
    state.speed = Math.max(0, state.speed - dt * 15); state.condition = Math.max(0, state.condition - dt * 25 / car.robustness); state.tires = Math.max(0, state.tires - dt * 0.35);
  }
  state.collisionCooldown = Math.max(0, state.collisionCooldown - dt);
  const building=buildingAt(state.distance,state.x,state.route);
  if(building){
    const bounds=getServiceLayout(building);
    if(previousDistance<bounds.buildingStart)state.distance=bounds.buildingStart-18;
    else state.x=previousX<bounds.buildingLeft?bounds.buildingLeft-.15:bounds.buildingRight+.15;
    if(state.collisionCooldown===0){state.condition=Math.max(0,state.condition-Math.min(5,1+state.speed*.04));log(state,'Kontakt mit dem Servicegebäude.');}
    state.speed=0;state.collisionCooldown=2;
  }
  updateRoadTraffic(state,dt,{log:text=>log(state,text),say:(text,priority)=>say(state,text,priority)});
  state.elapsed += virtualSeconds; state.drivingTime += dt;
  const county = getCurrentCounty(state);
  const countyIndex = state.counties.indexOf(county);
  if (countyIndex !== state.countyIndex) { state.countyIndex = countyIndex; log(state, `${county.name}: Tempolimit ${county.speedLimit} mph.`, 'milestone'); say(state, `${county.name}. Tempolimit ${county.speedLimit} Meilen.`); }
  state.lastSpeedLimit = getRoadSample(state.distance, state.route).speedLimit * 1.609344;
  navigationHints(state);
  updatePolice(state, previousDistance, dt);
  resolveTrafficAfterPolice(state,dt,{log:text=>log(state,text),say:(text,priority)=>say(state,text,priority)});
  checkResources(state);
  if (state.status === 'driving' && state.distance >= STAGE_LENGTH) {
    if (state.police.mode === 'pursuit') escape(state, true);
    state.distance = STAGE_LENGTH; state.status = 'finished'; state.speed = 0;
    log(state, 'Pennsylvania geschafft. Ohio und die weitere Kampagne sind in diesem Prototyp noch nicht spielbar.', 'milestone');
  }
  if (state.comment && state.comment.until <= state.drivingTime) state.comment = null;
  const parked=serviceAtParking(state.distance,state.x,state.route);
  if(state.serviceExitBlock&&parked?.id!==state.serviceExitBlock)state.serviceExitBlock=null;
  if(state.status==='driving'&&parked&&parked.id!==state.serviceExitBlock&&state.speed<=2.5)enterService(state);
}
export function updateRun(state: RunState, input: InputState, dt: number): void {
  if (state.status !== 'driving' || !Number.isFinite(dt) || dt <= 0 || dt > 60) return;
  let remaining = dt;
  while (remaining > 1e-8 && state.status === 'driving') { const step = Math.min(remaining, 1 / 60); tick(state, input, step); remaining -= step; }
}
function safeService(state: RunState): ServiceDef | null {
  const stop = SERVICES.find(stop => stop.id === state.serviceId);
  return stop && state.status === 'service' && state.speed <= 2.5 && serviceAtParking(state.distance,state.x,state.route)?.id===stop.id && state.police.mode !== 'pursuit' && state.violations < 3 && state.fuel > 0 && state.condition > 0 && state.fatigue[state.activeDriver] < 100 ? stop : null;
}
function offers(stop: ServiceDef, action: ServiceAction): boolean {
  return stop.kind === 'truckstop' || (action === 'refuel' && ['fuel', 'garage'].includes(stop.kind)) || (action === 'repair' && stop.kind === 'garage') || (action === 'rest' && stop.kind === 'diner');
}
export function enterService(state: RunState): boolean {
  if (state.status !== 'driving' || state.speed > 2.5 || state.police.mode === 'pursuit') return false;
  const stop = serviceAtParking(state.distance,state.x,state.route);
  if(stop?.id===state.serviceExitBlock)return false;
  if (!stop) return false;
  state.status = 'service'; state.serviceId = stop.id; state.speed = 0; state.rpm = 900;
  state.countyIndex = state.counties.indexOf(getCurrentCounty(state));
  state.lastSpeedLimit = getRoadSample(state.distance, state.route).speedLimit * 1.609344;
  log(state, `${stop.name}: angehalten.`, 'service');
  return true;
}
export function serviceAction(state: RunState, action: ServiceAction): ActionResult {
  const stop = safeService(state);
  if (!stop || !ACTIONS.includes(action)) return { ok: false, message: 'Hier ist kein sicherer Service möglich.' };
  if (action === 'leave') { state.status = 'driving'; state.serviceExitBlock=state.serviceId; state.serviceId = null; return { ok: true, message: 'Weiterfahrt.' }; }
  if (action === 'swap') {
    state.activeDriver = (1 - state.activeDriver) as 0 | 1;
    log(state, `${driver(state).name} übernimmt das Steuer.`, 'service');
    return { ok: true, message: 'Fahrer gewechselt.' };
  }
  if (!offers(stop, action)) return { ok: false, message: 'Diese Station bietet den Service nicht an.' };
  const key = `${stop.id}:${action}`;
  const fullKey = `${stop.id}:full`;
  if (state.serviced.includes(key) || state.serviced.includes(fullKey) || (action === 'full' && state.serviced.some(key => key.startsWith(`${stop.id}:`)))) return { ok: false, message: 'Dieser Service wurde hier bereits genutzt.' };
  const repairFactor = clamp(Math.min(...state.crew.map(id => CREW.find(person => person.id === id)!.repair)), 0.65, 1.1);
  const minutes = action === 'refuel' ? 7 : action === 'repair' ? 18 * repairFactor : action === 'rest' ? 35 : 45 * repairFactor;
  const rest = action === 'refuel' ? 3 : action === 'repair' ? 10 : action === 'rest' ? 38 : 55;
  advancePenalty(state, minutes * 60);
  if (action === 'refuel' || action === 'full') state.fuel = vehicle(state).tank;
  if (action === 'repair' || action === 'full') { state.condition = 100; state.tires = 100; }
  state.fatigue = state.fatigue.map(value => Math.max(0, value - rest)) as [number, number];
  state.serviced.push(key);
  log(state, `${stop.name}: ${action}, ${Math.round(minutes)} Minuten.`, 'service');
  return { ok: true, message: `${Math.round(minutes)} Minuten berechnet.` };
}
export function serializeRun(state: RunState): string | null {
  if (!safeService(state)) return null;
  try { const raw = JSON.stringify(state); return restoreRun(raw) ? raw : null; } catch { return null; }
}
const finite = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const integer = (value: unknown, min: number, max: number): value is number => finite(value, min, max) && Number.isInteger(value);
const str = (value: unknown, max = 240): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const strings = (value: unknown, max: number): value is string[] => Array.isArray(value) && value.length <= max && value.every(value => str(value)) && new Set(value).size === value.length;
// Legacy input is kept untrusted until the complete v2 validation below succeeds.
function migrateV1(value:Record<string,unknown>):Record<string,unknown>|null {
  if(JSON.stringify(Object.keys(value).sort())!==JSON.stringify(OLD_RUN_KEYS)||!integer(value.seed,0,0xffffffff)||value.status!=='service'||!finite(value.x,-1.5,1.5)||!finite(value.speed,0,35))return null;
  const stop=SERVICES.find(stop=>stop.id===value.serviceId);
  if(!stop||!finite(value.distance,stop.distance-2500,stop.distance+2500)||!Array.isArray(value.counties)||value.counties.length!==6||!Array.isArray(value.traffic)||!value.police||typeof value.police!=='object')return null;
  const canonical=generateCounties(value.seed);
  const counties=value.counties as CountyPlan[];
  for(let i=0;i<6;i++){
    if(!counties[i]||!!counties[i].police!==!!canonical[i].police)return null;
    counties[i].policeRoll=canonical[i].policeRoll;counties[i].policeCandidate={...canonical[i].policeCandidate};
  }
  const bounds=getServiceLayout(stop),distance=value.distance;
  value.version=2;value.escapes=0;value.serviceExitBlock=null;value.x=1.75;value.speed=0;
  if(distance<bounds.parkStart||distance>bounds.parkEnd)value.distance=stop.distance;
  value.countyIndex=canonical.findIndex(county=>(value.distance as number)<county.end);
  (value.police as Record<string,unknown>).pursuitTime=0;
  for(const car of value.traffic as TrafficCar[]){
    if(!car||typeof car!=='object')return null;
    car.route='main';car.condition=100;car.targetX=car.x;car.passingId=null;
    car.desiredSpeed=car.role==='traffic'?Math.min(car.speed,car.body==='truck'?70:85):car.speed;
  }
  return value;
}
export function restoreRun(raw: string): RunState | null {
  try {
    if(typeof raw!=='string'||raw.length>150000)return null;
    let value:unknown=JSON.parse(raw);
    if(!value||typeof value!=='object'||Array.isArray(value))return null;
    if((value as Record<string,unknown>).version===1)value=migrateV1(value as Record<string,unknown>);
    if(!value||typeof value!=='object'||Array.isArray(value))return null;
    const s=value as RunState;
    if(s.version!==2||s.stageId!=='pa'||!integer(s.seed,0,0xffffffff)||!integer(s.rng,0,0xffffffff)||s.status!=='service')return null;
    if(JSON.stringify(Object.keys(s).sort())!==JSON.stringify(RUN_KEYS))return null;
    const car=VEHICLES.find(car=>car.id===s.vehicleId);
    if(!car||!Array.isArray(s.crew)||s.crew.length!==2||s.crew[0]===s.crew[1]||s.crew.some(id=>!CREW.some(person=>person.id===id))||!integer(s.activeDriver,0,1))return null;
    if(!finite(s.distance,0,STAGE_LENGTH-.001)||!finite(s.x,-1.5,3.5)||!finite(s.speed,0,2.5)||!integer(s.gear,1,car.gears)||!finite(s.rpm,0,7000)||!finite(s.fuel,.000001,car.tank)||!finite(s.condition,.000001,100)||!finite(s.tires,0,100))return null;
    if(!Array.isArray(s.fatigue)||s.fatigue.length!==2||!s.fatigue.every(value=>finite(value,0,100))||s.fatigue[s.activeDriver]>=100)return null;
    if(!finite(s.elapsed,0,10000000)||!finite(s.drivingTime,0,1000000)||!finite(s.timePenalties,0,s.elapsed)||Math.abs(s.elapsed-(s.drivingTime*TIME_SCALE+s.timePenalties))>.05)return null;
    if(!integer(s.escapes,0,6)||(s.serviceExitBlock!==null&&!SERVICES.some(stop=>stop.id===s.serviceExitBlock)))return null;
    if(!integer(s.countyIndex,0,5)||!Array.isArray(s.counties)||s.counties.length!==6)return null;
    const canonical=generateCounties(s.seed),chance=Math.min(.9,.58+s.escapes*.1);
    const validEvent=(actual:PoliceEvent,expected:PoliceEvent)=>actual&&actual.id===expected.id&&actual.kind===expected.kind&&actual.trigger===expected.trigger&&typeof actual.activated==='boolean'&&typeof actual.resolved==='boolean';
    for(let i=0;i<canonical.length;i++){
      const actual=s.counties[i],expected=canonical[i];
      if(!actual||actual.id!==expected.id||actual.name!==expected.name||actual.start!==expected.start||actual.end!==expected.end||actual.speedLimit!==expected.speedLimit||actual.rough!==expected.rough||actual.policeRoll!==expected.policeRoll)return null;
      if(!validEvent(actual.policeCandidate,expected.policeCandidate)||actual.policeCandidate.activated||actual.policeCandidate.resolved)return null;
      if(actual.police===null){if(expected.police||(actual.start>s.distance&&actual.policeRoll<chance))return null;}
      else if(!validEvent(actual.police,expected.policeCandidate)||actual.policeRoll>=chance)return null;
    }
    const policeIds=s.counties.flatMap(county=>county.police?[county.police.id]:[]);
    if(s.countyIndex!==s.counties.indexOf(getCurrentCounty(s)))return null;
    if(!strings(s.confirmedEvents,2)||!integer(s.violations,0,2)||s.confirmedEvents.length!==s.violations||s.confirmedEvents.some(id=>!policeIds.includes(id)))return null;
    if(!strings(s.triggered,200)||!strings(s.serviced,30))return null;
    if(s.serviced.some(key=>!SERVICES.some(stop=>(['refuel','repair','rest','full'] as ServiceAction[]).some(action=>key===`${stop.id}:${action}`&&offers(stop,action)))))return null;
    if(s.route!=='main'||!['main','detour'].includes(s.routeChoice)||!str(s.serviceId)||!finite(s.collisionCooldown,0,2)||!finite(s.lastSpeedLimit,1,200)||s.failureReason!==null)return null;
    const p=s.police;
    if(!p||!['idle','watching','escaped','caught','departing'].includes(p.mode)||!finite(p.gap,-100000,100000)||p.catchProgress!==0||!finite(p.cooldown,0,1000)||!finite(p.pursuitTime,0,1000000)||(p.eventId!==null&&!policeIds.includes(p.eventId)))return null;
    if(p.mode==='watching'&&p.eventId===null)return null;
    if(!Array.isArray(s.rivals)||s.rivals.length!==4||s.rivals.some((rival,i)=>!rival||rival.id!==`rival-${i}`||!str(rival.name)||!str(rival.color)||!finite(rival.distance,-20000,STAGE_LENGTH+2000)||!finite(rival.speed,1,250)||!finite(rival.stopUntil,0,10000000)))return null;
    if(s.rivals.some(rival=>(rival.violations!==undefined&&!integer(rival.violations,0,6))||(rival.policeStopUntil!==undefined&&!finite(rival.policeStopUntil,0,10000000))))return null;
    if(!Array.isArray(s.traffic)||s.traffic.length<24||s.traffic.length>25||new Set(s.traffic.map(car=>car.id)).size!==s.traffic.length)return null;
    for(const traffic of s.traffic){
      if(!traffic||!str(traffic.id)||!finite(traffic.distance,-40000,STAGE_LENGTH+100000)||!finite(traffic.x,-1.5,7)||!finite(traffic.speed,0,300)||!str(traffic.color)||!['sports','sedan','van','rv','truck'].includes(traffic.body)||typeof traffic.oncoming!=='boolean'||!['traffic','rival','police'].includes(traffic.role))return null;
      if(traffic.route!==undefined&&!['main','detour'].includes(traffic.route))return null;
      if(traffic.condition!==undefined&&!finite(traffic.condition,0,100))return null;
      if(traffic.desiredSpeed!==undefined&&!finite(traffic.desiredSpeed,0,300))return null;
      if(traffic.targetX!==undefined&&!finite(traffic.targetX,-1.5,7))return null;
      if(traffic.passingId!==undefined&&traffic.passingId!==null&&traffic.passingId!=='player'&&!s.traffic.some(other=>other.id===traffic.passingId))return null;
      if(traffic.siren!==undefined&&typeof traffic.siren!=='boolean')return null;
      if(traffic.hornUntil!==undefined&&!finite(traffic.hornUntil,0,1000001))return null;
      if(traffic.role==='traffic'&&!/^traffic-(?:[0-9]|1[0-9])$/.test(traffic.id))return null;
      if(traffic.role==='rival'&&!s.rivals.some(rival=>rival.id===traffic.id&&rival.distance===traffic.distance))return null;
      if(traffic.role==='police'&&traffic.id!==`police:${p.eventId}`)return null;
    }
    if(s.traffic.filter(traffic=>traffic.role==='traffic').length!==20||s.traffic.filter(traffic=>traffic.role==='rival').length!==4||s.traffic.filter(traffic=>traffic.role==='police').length>1)return null;
    if(p.mode==='watching'&&!s.traffic.some(traffic=>traffic.role==='police'))return null;
    if(!Array.isArray(s.log)||s.log.length>120||s.log.some(entry=>!entry||!finite(entry.time,0,s.elapsed)||!str(entry.text,600)||!['info','police','service','milestone'].includes(entry.kind)))return null;
    if(s.comment!==null&&(!s.comment||!str(s.comment.text,600)||!str(s.comment.speaker)||!finite(s.comment.until,0,1000000)||!integer(s.comment.priority,0,10)))return null;
    return safeService(s)?s:null;
  }catch{return null;}
}
