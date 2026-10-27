import test from 'node:test';
import assert from 'node:assert/strict';
import { SERVICES, BRANCH } from '../src/data.ts';
import { buildingAt, detourOffset, getDetourHalfWidth, getRoadHalfWidth, getRouteOffset, getServiceLayout, isDrivable, isServiceApron, serviceAtParking } from '../src/layout.ts';

test('a highway stop is not a parking bay, while the painted service position is',()=>{
  const stop=SERVICES[0];
  assert.equal(serviceAtParking(stop.distance,.75,'main'),null);
  assert.equal(serviceAtParking(stop.distance,1.75,'main')?.id,stop.id);
  assert.equal(serviceAtParking(stop.distance,1.75,'detour'),null);
  assert.equal(serviceAtParking(stop.distance+1000,1.75,'main'),null);
});
test('the same footprint keeps the painted forecourt drivable and solid building separate',()=>{
  const stop=SERVICES[0],layout=getServiceLayout(stop);
  assert.equal(isServiceApron(stop.distance,1.75,'main'),true);
  assert.equal(isDrivable(stop.distance,1.75,'main'),true);
  assert.equal(buildingAt(stop.distance,1.75,'main'),null);
  const front=(layout.buildingStart+layout.buildingEnd)/2;
  assert.equal(buildingAt(front,2.8,'main')?.id,stop.id);
  assert.equal(isDrivable(front,2.8,'main'),false);
  assert.equal(buildingAt(front,2.8,'detour'),null);
});
test('the right ramp grows from the edge, remains continuous at choice, and rejoins main',()=>{
  assert.equal(getDetourHalfWidth(BRANCH.start-1),0);
  assert.ok(getDetourHalfWidth(BRANCH.start+1)<.05);
  assert.equal(getRoadHalfWidth(BRANCH.decision,'detour'),.55);
  assert.ok(Math.abs(detourOffset(BRANCH.decision+.01)-detourOffset(BRANCH.decision-.01))<.001);
  assert.equal(getRouteOffset(BRANCH.decision,'main'),0);
  assert.equal(getRouteOffset(BRANCH.decision,'detour'),1.05);
  assert.ok(detourOffset(BRANCH.end-1)<.001);assert.equal(detourOffset(BRANCH.end),0);
  assert.equal(isDrivable(BRANCH.decision-1,1.25,'main'),true);
});
