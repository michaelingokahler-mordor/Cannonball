import test from 'node:test';
import assert from 'node:assert/strict';

async function rules(){const m=await import('../src/driving.ts').catch(()=>null);assert.ok(m,'adapted Velvet Cruise driving rules must be available');return m;}
const self={id:'car',distance:1000,x:.75,targetX:.75,speed:90,half:.185};

test('the Velvet swept lane reservation rejects a crossing intent even when both endpoints miss the target',async()=>{
  const {laneChangeIsClear}=await rules();
  const other={id:'other',distance:1050,x:.9,targetX:-.25,speed:90,half:.185};
  assert.equal(laneChangeIsClear(self,.25,[other]),false);
});
test('the Velvet predictive gap blocks a fast rear arrival during the lane change',async()=>{
  const {laneChangeIsClear}=await rules();
  const fast={id:'other',distance:750,x:.25,targetX:.25,speed:160,half:.185};
  assert.equal(laneChangeIsClear(self,.25,[fast]),false);
});
test('moving out of a nearby player lane is allowed while merging into it waits',async()=>{
  const {laneChangeIsClear}=await rules();
  const player={id:'player',distance:1040,x:.75,targetX:.75,speed:80,half:.185};
  assert.equal(laneChangeIsClear(self,.25,[player]),true);
  assert.equal(laneChangeIsClear({...self,x:.25},.75,[player]),false);
});
test('a clear adjacent lane remains usable',async()=>{
  const {laneChangeIsClear}=await rules();
  assert.equal(laneChangeIsClear(self,.25,[{...self,id:'other',distance:3000}]),true);
});
