import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession, readSettings, SAVE_KEY, SETTINGS_KEY } from '../src/session.ts';
import { enterService } from '../src/simulation.ts';
import { SERVICES } from '../src/data.ts';

function storage(){const data=new Map<string,string>();return {data,getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};}
test('settings load uses a whitelist and cannot inject nonfinite canvas sizes',()=>{
  const s=storage();s.data.set(SETTINGS_KEY,JSON.stringify({view:'cockpit',resolution:'960x540',map:true,units:'mph',sound:false,speech:true}));
  assert.equal(readSettings(s).view,'cockpit');assert.equal(readSettings(s).resolution,'1280x720');
  s.data.set(SETTINGS_KEY,'{"resolution":"999999x999999","view":"evil"}');
  assert.equal(readSettings(s).resolution,'640x360');
});
test('changing camera, map and native resolution never changes the journey or county outcomes',()=>{
  const s=new GameSession(storage());s.start({seed:42});
  const before=JSON.stringify(s.state);
  s.setSettings({view:'cockpit',map:true,resolution:'1280x720'});
  assert.equal(s.settings.resolution,'1280x720'); assert.equal(JSON.stringify(s.state),before);
});
test('save is denied while driving and a saved service restores exactly after a new session',()=>{
  const store=storage(),s=new GameSession(store);s.start({seed:42});
  assert.equal(s.save().ok,false);assert.equal(store.data.has(SAVE_KEY),false);
  s.state!.distance=SERVICES[0].distance;s.state!.x=1.75;s.state!.speed=0;
  assert.equal(enterService(s.state!),true);assert.equal(s.save().ok,true);
  const next=new GameSession(store);assert.equal(next.hasSave(),true);assert.equal(next.load().ok,true);
  assert.deepEqual(next.state,s.state);
});
test('bad snapshots and unavailable storage leave the current run intact',()=>{
  const store=storage(),s=new GameSession(store);s.start({seed:5});const before=JSON.stringify(s.state);
  store.data.set(SAVE_KEY,'{"version":1,"fuel":null}');assert.equal(s.load().ok,false);assert.equal(JSON.stringify(s.state),before);
  const blocked=new GameSession({getItem(){throw new Error('blocked');},setItem(){throw new Error('quota');}});
  assert.equal(blocked.hasSave(),false);blocked.start();
  blocked.state!.distance=SERVICES[0].distance;blocked.state!.x=1.75;blocked.state!.speed=0;enterService(blocked.state!);
  assert.equal(blocked.save().ok,false);
});
test('paused play cannot consume fuel or advance police and time',()=>{
  const s=new GameSession(storage());s.start();s.state!.speed=120;s.pause();
  const before=JSON.stringify(s.state);s.step({throttle:1,brake:0,steer:0},.1);assert.equal(JSON.stringify(s.state),before);
  s.resume();assert.equal(s.state!.status,'driving');
});
