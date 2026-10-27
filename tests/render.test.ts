import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRenderer } from '../src/render.ts';
import { createRun } from '../src/simulation.ts';
import { getRouteOffset } from '../src/layout.ts';
import type { RunState, ViewSettings } from '../src/model.ts';

function harness() {
  let draws=0;const texts:string[]=[],translations:number[][]=[];
  const ctx=new Proxy({
    fillText:(text:string)=>texts.push(text),
    translate:(x:number,y:number)=>translations.push([x,y]),
    getTransform:()=>({a:1,b:0,c:0,d:1,e:0,f:0}),
    createLinearGradient:()=>({addColorStop(){}}),
  } as Record<string,unknown>,{get(target,key){
    if(key in target)return target[key as string];
    return (...args:unknown[])=>{draws++;for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n),`nonfinite ${String(key)} argument`);};
  }});
  const canvas={width:0,height:0,style:{},getContext:()=>ctx};
  return {renderer:new GameRenderer(canvas as unknown as HTMLCanvasElement),canvas,draws:()=>draws,texts,translations};
}
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}
  return value;
}

test('all cameras and native resolutions draw finite geometry without changing world or RNG',()=>{
  const {renderer,canvas,draws}=harness();
  for(const [distance,route,x] of [[0,'main',.75],[44900,'main',1.75],[102020,'detour',.2],[115000,'detour',0],[158000,'main',.75],[359000,'main',.75]] as const) {
    const state=createRun();Object.assign(state,{distance,route,x});freeze(state);
    const before=JSON.stringify(state);
    for(const view of ['arcade','cockpit'] as const)for(const resolution of ['640x360','1280x720'] as const){
      const settings:ViewSettings={view,resolution,map:true,units:'mph',sound:false,speech:false};
      const stats=renderer.render(state,settings);
      assert.equal(canvas.width,resolution==='640x360'?640:1280);
      assert.equal(canvas.height,resolution==='640x360'?360:720);
      assert.ok(Number.isFinite(stats.frameMs));assert.equal(JSON.stringify(state),before);
    }
  }
  assert.ok(draws()>1000);
});

test('a stopped car 28m ahead remains above the player body in both cameras',()=>{
  for(const view of ['arcade','cockpit'] as const){
    const {renderer,translations}=harness(),state=createRun();state.distance=600;state.x=.75;state.rivals=[];state.traffic=[];
    const settings:ViewSettings={view,resolution:'640x360',map:false,units:'mph',sound:false,speech:false};
    renderer.render(state,settings);const baseline=translations.map(t=>JSON.stringify(t));translations.length=0;
    state.traffic=[{id:'stopped',distance:628,x:.75,speed:0,color:'#fff',body:'sedan',oncoming:false,role:'traffic'}];
    const stats=renderer.render(state,settings);
    for(const old of baseline){const index=translations.findIndex(t=>JSON.stringify(t)===old);if(index>=0)translations.splice(index,1);}
    const anchor=translations.find(t=>t[0]>300&&t[0]<340);
    assert.ok(anchor,'the actual front vehicle must draw');
    assert.ok(anchor[1]>120&&anchor[1]<(view==='arcade'?290:245),`28m front body hidden at y=${anchor[1]} in ${view}`);
    assert.equal(stats.objects,1);
  }
});
test('arcade player body occupies its own physical lane instead of the road centre',()=>{
  const {renderer,translations}=harness(),state=createRun();state.distance=600;state.x=.75;state.rivals=[];state.traffic=[];
  renderer.render(state,{view:'arcade',resolution:'640x360',map:false,units:'mph',sound:false,speech:false});
  assert.ok(translations.some(([x,y])=>Math.abs(x-320)<1&&Math.abs(y-330)<3),'the player follows the camera lane at its 42m anchor');
});

test('subpixel or offscreen vehicles do not count as visible traffic',()=>{
  const {renderer}=harness(),state=createRun();state.distance=600;state.rivals=[];
  for(const car of [
    {id:'tiny',distance:6000,x:.75},
    {id:'outside',distance:700,x:1000},
  ]){
    state.traffic=[{...car,speed:0,color:'#fff',body:'sedan',oncoming:false,role:'traffic'}];
    const stats=renderer.render(state,{view:'arcade',resolution:'640x360',map:false,units:'mph',sound:false,speech:false});
    assert.equal(stats.objects,0,`${car.id} must not count as visibly drawn`);
  }
});

test('authored bends visibly move the broad road in both camera views',()=>{
  const {renderer}=harness(),r=renderer as any;
  for(const view of ['arcade','cockpit'] as const){
    r.currentView=view;
    const state=createRun();state.distance=12000;state.x=0;
    const ps=r.projections(state,view==='arcade'?360:281,false,'main');
    const near=r.projectAt(ps,70),far=r.projectAt(ps,230);
    assert.ok(Math.abs(far.x-near.x)>20,`${view} broad road must show the announced bend`);
  }
});

test('right atlas keeps readable stop names and restores geographic context',()=>{
  const {renderer,texts}=harness(),state=createRun();
  renderer.render(state,{view:'arcade',resolution:'640x360',map:true,units:'mph',sound:false,speech:false});
  assert.ok(texts.includes('ROAD ATLAS · 70ER'));
  for(const name of ['Sundown Gas','Miller’s Garage','Bluebird Diner','Keystone Truckstop','Last Chance Service'])assert.ok(texts.includes(name));
});

test('physical camera is lower for sports car, follows the starting grade and fills foreground',()=>{
  const {renderer}=harness();const r=renderer as any;r.currentView='cockpit';
  const state=createRun();
  const sports=r.projections(state,281,false,'main');
  state.vehicleId='hohenfels';const sedan=r.projections(state,281,false,'main');
  const index=sports.findIndex((p:any)=>p.d>=100);
  assert.ok(sedan[index].y>sports[index].y,'higher sedan eye must see a taller near-road plane');
  assert.ok(sports[0].y>281,'near road must extend below windshield');
  assert.ok(sports[index].y>281*.46,'initial uphill grade must not erase the 100m sightline');
});

test('crossing the fork preserves physical camera position and gives the detour its own width',()=>{
  const {renderer}=harness();const r=renderer as any;
  const before=createRun();before.distance=102000;before.x=1.08;
  const after=structuredClone(before);after.route='detour';after.x-=getRouteOffset(after.distance,'detour');
  const a=r.projections(before,360,false,'main'),b=r.projections(after,360,false,'main');
  for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i].x-b[i].x)<1e-8);
  const main=createRun();main.distance=115000;
  const highway=r.projections(main,360,false,'main'),detour=r.projections(main,360,false,'detour');
  const index=highway.findIndex((p:any)=>p.d>=100);
  assert.ok(detour[index].x>highway[index].x);
  assert.ok(Math.abs(detour[index].half/highway[index].half-.55)<1e-9);
});

test('only actual front/rear traffic entities contribute to mirror counts',()=>{
  const {renderer}=harness();const state=createRun();state.distance=180000;state.rivals=[];
  state.traffic=[
    {id:'front',distance:180300,x:.75,speed:90,color:'#bbb',body:'sedan',oncoming:false,role:'traffic'},
    {id:'rear-officer',distance:179800,x:.75,speed:90,color:'#ddd',body:'sedan',oncoming:false,role:'police'},
  ];
  for(const view of ['arcade','cockpit'] as const){
    const result=renderer.render(state,{view,resolution:'640x360',map:false,units:'kmh',sound:false,speech:false});
    assert.equal(result.objects,1);assert.equal(result.mirrorObjects,1);
  }
  (state as RunState).traffic=[];
  const empty=renderer.render(state,{view:'arcade',resolution:'640x360',map:false,units:'kmh',sound:false,speech:false});
  assert.equal(empty.objects,0);assert.equal(empty.mirrorObjects,0);
});

test('quiet HUD retains ordinary passenger remarks without overspeed or shift popups',()=>{
  const {renderer,texts}=harness();const state=createRun();state.speed=180;state.rpm=6500;
  state.comment={text:'Die nächste Kurve zieht nach rechts.',speaker:'Rose Carter',until:10,priority:0};
  for(const view of ['arcade','cockpit'] as const){
    texts.length=0;renderer.render(state,{view,resolution:'640x360',map:false,units:'kmh',sound:false,speech:false});
    assert.ok(texts.includes('Rose: Die nächste Kurve zieht nach rechts.'));
    assert.ok(!texts.some(t=>/UPSHIFT|TEMPO ÜBER LIMIT|ABZWEIG:/.test(t)));
  }
});

test('101900m main-road fork approach excludes the tree occupying the paved ramp',()=>{
  const {renderer}=harness();const r=renderer as any,state=createRun();
  state.distance=101900;state.x=1.25;state.route='main';
  const clear=r.sceneryClear.bind(r);let offendingTreeRejected=false;
  r.sceneryClear=(distance:number,x:number,width:number)=>{
    const result=clear(distance,x,width);
    // First right-hand scenery anchor ahead in the reported frame (55m away).
    if(distance===101955&&Math.abs(x-1.3848597669534177)<1e-8)offendingTreeRejected=!result;
    return result;
  };
  renderer.render(state,{view:'arcade',resolution:'1280x720',map:false,units:'kmh',sound:false,speech:false});
  assert.ok(offendingTreeRejected,'the actual scene generator must reject this ramp tree');
  assert.equal(clear(101955,-2.5,.4),true,'unrelated scenery outside both roads remains allowed');
  for(const route of ['main','detour'] as const){
    const center=getRouteOffset(105000,route);
    assert.equal(clear(105000,center,.4),false,`${route} road cannot contain decoration`);
  }
});
test('a house whose near footprint crosses the departing fork is excluded from the actual scene',()=>{
  const {renderer}=harness(),r=renderer as any,state=createRun();state.distance=101900;state.x=1.15;
  const clear=r.sceneryClear.bind(r);let houseRejected=false;
  r.sceneryClear=(distance:number,x:number,width:number)=>{
    const result=clear(distance,x,width);
    if(distance===102060&&x>3.20&&x<3.21&&width===.65)houseRejected=!result;
    return result;
  };
  renderer.render(state,{view:'arcade',resolution:'1280x720',map:false,units:'mph',sound:false,speech:false});
  assert.ok(houseRejected,'the full house plot overlaps the road turning past its anchor');
  assert.equal(clear(102060,-3.2,.65),true,'the opposite road side remains available for scenery');
});
