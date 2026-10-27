import type { Comment, CrewDef, RunState } from './model.ts';
import { BRANCH, SERVICES } from './data.ts';
import { getRoadSample, nextRoadBend } from './road.ts';

export interface NavigationCue {
  id: string;
  kind: 'service' | 'branch' | 'speed' | 'curve' | 'landmark';
  distance: number;
  text: string;
  priority: number;
}

const TONE: Record<string, string> = {
  pro: 'Ruhig: ', economist: 'Sanft: ', endurance: 'Nur Ruhe: ',
  mechanic: 'Hör zu: ', navigator: 'Karte sagt: ', daredevil: 'Na los: ',
};

/** Critical instructions stay verbatim; ordinary conversation reflects the passenger. */
export function makePassengerComment(passenger: CrewDef, text: string, now: number, priority: number): Comment {
  return { text: priority >= 3 ? text : `${TONE[passenger.archetype] ?? ''}${text}`,
    speaker: passenger.name, until: now + 7, priority };
}

/** Equal-priority remarks wait, so a fresh road instruction is readable for seven seconds. */
export function canReplaceComment(current: Comment | null, now: number, priority: number): boolean {
  return current === null || current.until <= now || current.priority < priority;
}

/** Pure cue generation: no RNG, state mutation or camera-dependent inputs. */
export function getNavigationCues(state: RunState, passenger: CrewDef): NavigationCue[] {
  const cues: NavigationCue[] = [];
  const navigation = passenger.navigation;
  for (const stop of SERVICES) {
    if (state.route==='main' && stop.distance > state.distance && stop.distance - state.distance <= 3500 * navigation) {
      cues.push({ id: `service-hint:${stop.id}`, kind: 'service', distance: stop.distance,
        text: `${stop.name}: rechts auf der Markierung stoppen.`, priority: 2 });
    }
  }
  if (state.distance >= BRANCH.start - 2500 * navigation && state.distance < BRANCH.start) {
    cues.push({ id: 'branch-hint', kind: 'branch', distance: BRANCH.start,
      text: 'Abzweig: rechts zur Nebenstraße lenken, sonst geradeaus.', priority: 2 });
  }
  for (const distance of [75000, 275000]) {
    const next = getRoadSample(distance + 1, state.route).speedLimit;
    const previous = getRoadSample(distance - 1, state.route).speedLimit;
    if (next < previous && state.distance >= distance - 3200 * navigation && state.distance < distance) {
      cues.push({ id: `speed-hint:${distance}`, kind: 'speed', distance,
        text: `Ort voraus: auf ${next} mph (${Math.round(next * 1.609344)} km/h) abbremsen.`, priority: 2 });
    }
  }
  const bend=nextRoadBend(state.distance,state.route);
  if(bend&&state.distance<bend.start&&bend.start-state.distance<=1800*navigation){
    cues.push({id:`curve-hint:${bend.id}`,kind:'curve',distance:bend.start,
      text:`Kurve nach ${bend.direction==='right'?'rechts':'links'} voraus. Tempo prüfen, Spur halten.`,priority:1});
  }
  const landmarks = [
    { id: 'susquehanna', distance: 132000, text: 'Susquehanna-Land: Wald und sanfte Hügel bis zum Horizont.' },
    // Original fictional viewpoint, not a claim about a historical Pennsylvania site.
    { id: 'keystone-lookout', distance: 194000, text: 'Aussichtspunkt „Keystone Lookout“: bewaldete Hügel.' },
    { id: 'allegheny', distance: 242000, text: 'Allegheny-Land: Wälder, Höhenzüge und noch viel Straße.' },
  ];
  for (const landmark of landmarks) {
    if (state.distance >= landmark.distance && state.distance < landmark.distance + 6000) {
      cues.push({ id: `landmark:${landmark.id}`, kind: 'landmark', distance: landmark.distance,
        text: landmark.text, priority: 0 });
    }
  }
  return cues;
}

export function nextNavigationCue(state: RunState, passenger: CrewDef): NavigationCue | null {
  return getNavigationCues(state, passenger)
    .filter(cue => !state.triggered.includes(cue.id) && canReplaceComment(state.comment, state.drivingTime, cue.priority))
    .sort((a, b) => b.priority - a.priority || a.distance - b.distance)[0] ?? null;
}
