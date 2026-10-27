export type RouteChoice = 'main' | 'detour';
export type ViewMode = 'arcade' | 'cockpit';
export type Resolution = '640x360' | '1280x720';
export type RunStatus = 'driving' | 'paused' | 'service' | 'finished' | 'failed';
export type TestScenarioId = 'traffic' | 'police' | 'fork' | 'curves' | 'service';
export type ServiceKind = 'fuel' | 'garage' | 'diner' | 'truckstop';
export type ServiceAction = 'refuel' | 'repair' | 'rest' | 'full' | 'swap' | 'leave';
export type BodyStyle = 'sports' | 'sedan' | 'van' | 'rv';

export interface VehicleDef {
  id: string; name: string; family: string; reference: string; color: string;
  body: BodyStyle; transmission: 'manual' | 'automatic'; gears: number;
  gearSpeeds: number[]; maxSpeed: number; acceleration: number; handling: number;
  tank: number; consumption: number; fatigue: number; wear: number; robustness: number;
  prototype: boolean; unlockAfter?: string; eyeHeight?: number;
}
export interface CrewDef {
  id: string; name: string; gender: 'm' | 'f'; archetype: string; title: string;
  description: string; strength: string; weakness: string; color: string;
  fatigue: number; fuel: number; acceleration: number; handling: number;
  repair: number; navigation: number; stress: number;
}
export interface PoliceEvent {
  id: string; kind: 'radar' | 'patrol'; trigger: number;
  activated: boolean; resolved: boolean;
}
export interface CountyPlan {
  id: string; name: string; start: number; end: number; speedLimit: number;
  rough: boolean; police: PoliceEvent | null;
  policeRoll: number; policeCandidate: PoliceEvent;
}
export interface ServiceDef {
  id: string; name: string; kind: ServiceKind; distance: number; description: string;
}
export interface TrafficCar {
  id: string; distance: number; x: number; speed: number; color: string;
  body: BodyStyle | 'truck'; oncoming: boolean; role: 'traffic' | 'rival' | 'police';
  route?: RouteChoice; condition?: number; desiredSpeed?: number; targetX?: number; passingId?: string | null;
  hornUntil?: number; siren?: boolean;
}
export interface Rival {
  id: string; name: string; color: string; distance: number; speed: number; stopUntil: number;
  violations?: number; policeStopUntil?: number;
}
export interface PoliceState {
  mode: 'idle' | 'watching' | 'pursuit' | 'escaped' | 'caught' | 'departing'; gap: number;
  eventId: string | null; catchProgress: number; cooldown: number;
  pursuitTime: number;
}
export interface RunLog { time: number; text: string; kind: 'info' | 'police' | 'service' | 'milestone' }
export interface Comment { text: string; speaker: string; until: number; priority: number }
export interface RunState {
  version: 2; stageId: 'pa'; seed: number; rng: number; status: RunStatus;
  vehicleId: string; crew: [string, string]; activeDriver: 0 | 1;
  distance: number; x: number; speed: number; gear: number; rpm: number;
  fuel: number; condition: number; tires: number; fatigue: [number, number];
  elapsed: number; drivingTime: number; countyIndex: number; counties: CountyPlan[];
  traffic: TrafficCar[]; rivals: Rival[]; police: PoliceState;
  violations: number; confirmedEvents: string[]; timePenalties: number;
  log: RunLog[]; triggered: string[]; route: RouteChoice; routeChoice: RouteChoice;
  serviceId: string | null; serviced: string[]; comment: Comment | null;
  collisionCooldown: number; lastSpeedLimit: number; failureReason: string | null;
  escapes: number; serviceExitBlock: string | null;
}
export interface InputState { throttle: number; brake: number; steer: number }
export interface RunOptions { seed?: number; vehicleId?: string; crew?: [string, string] }
export interface ActionResult { ok: boolean; message: string }
export interface ViewSettings {
  view: ViewMode; resolution: Resolution; map: boolean; units: 'kmh' | 'mph';
  sound: boolean; speech: boolean;
}
export interface RoadSample {
  curve: number; height: number;
  theme: 'farmland' | 'forest' | 'town' | 'ridge' | 'tunnel'; rough: boolean; speedLimit: number;
}
export interface RenderStats { frameMs: number; objects: number; mirrorObjects: number }
export interface UiActions {
  start: (vehicleId: string, crew: [string, string], seed?: number) => void;
  startTest?: (id:TestScenarioId,vehicleId:string,crew:[string,string])=>void;
  resume: () => void; pause: () => void; load: () => void; save: () => void;
  service: (action: ServiceAction) => void; settings: (change: Partial<ViewSettings>) => void;
  route: (route: RouteChoice) => void; enterService: () => void;
}
