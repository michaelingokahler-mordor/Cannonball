import test from 'node:test';
import assert from 'node:assert/strict';
import { BRANCH } from '../src/data.ts';
import { detourOffset } from '../src/layout.ts';
import { getRoadSample } from '../src/road.ts';
import { mapRoutePoint } from '../src/route-map.ts';

test('the Y approach and divergence occupy one short junction rather than many kilometres',()=>{
  assert.ok(BRANCH.decision-BRANCH.start<=1200,'approach is at most 1.2km');
  assert.ok(detourOffset(BRANCH.decision+1200)>=60,'the other road must depart the view after the junction');
  assert.ok(Math.abs(detourOffset(BRANCH.decision+.01)-detourOffset(BRANCH.decision-.01))<.001);
  assert.equal(detourOffset(BRANCH.end),0);
});

test('road turns have entry, an apex, and a straight exit, with a distinct detour profile',()=>{
  assert.ok(Math.abs(getRoadSample(12000).curve)>.5);
  assert.ok(Math.abs(getRoadSample(17000).curve)<.01,'a bend must end in a real straight');
  assert.ok(Math.abs(getRoadSample(120000,'main').curve-getRoadSample(120000,'detour').curve)>.1);
});
test('junction geometry stays legible without an unrelated bend through the fork nose',()=>{
  assert.equal(getRoadSample(101900,'main').curve,0);
});
test('atlas positions follow a winding main road and the selected detour rejoins at both ends',()=>{
  assert.deepEqual(mapRoutePoint(-1),mapRoutePoint(0));
  assert.deepEqual(mapRoutePoint(360001),mapRoutePoint(360000));
  const ys=[0,45000,115000,185000,255000,315000,360000].map(d=>mapRoutePoint(d).y);
  assert.ok(Math.max(...ys)-Math.min(...ys)>8);
  assert.deepEqual(mapRoutePoint(102000,'main'),mapRoutePoint(102000,'detour'));
  assert.deepEqual(mapRoutePoint(156000,'main'),mapRoutePoint(156000,'detour'));
  assert.ok(mapRoutePoint(129000,'detour').y-mapRoutePoint(129000).y>10);
});
