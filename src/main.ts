import './style.css';
import { GameSession } from './session.ts';
import { GameRenderer } from './render.ts';
import { GameUI } from './ui.ts';
import { GameAudio } from './audio.ts';
import { GamepadInput, KeyboardInput } from './input.ts';
import { enterService, serviceAction, shiftGear } from './simulation.ts';
import { TEST_SCENARIOS } from './test-scenarios.ts';
import type { RenderStats, UiActions } from './model.ts';

let storage:Storage|null=null;
try{storage=window.localStorage;}catch{/* blocked storage is reported when saving */}
const session=new GameSession(storage);
const keys=new KeyboardInput(window),pads=new GamepadInput(),audio=new GameAudio();
let renderer:GameRenderer;
let accumulator=0;
const actions:UiActions={
  start(vehicleId,crew,seed){
    try{
      session.start({vehicleId,crew,seed:seed??crypto.getRandomValues(new Uint32Array(1))[0]});
      ui.setTestScenarioLabel(null);
      accumulator=0;keys.clear();audio.unlock();
    }catch(error){ui.notify(error instanceof Error?error.message:'Fahrt konnte nicht gestartet werden.');}
  },
  startTest(id,vehicleId,crew){
    try{
      session.startTest(id,{vehicleId,crew});
      ui.setTestScenarioLabel(TEST_SCENARIOS.find(item=>item.id===id)?.name??id);
      accumulator=0;keys.clear();audio.unlock();
    }catch(error){ui.notify(error instanceof Error?error.message:'Testfahrt konnte nicht gestartet werden.');}
  },
  pause(){session.pause();keys.clear();},
  resume(){session.resume();keys.clear();accumulator=0;audio.unlock();},
  load(){const result=session.load();ui.notify(result.message);keys.clear();accumulator=0;if(result.ok){ui.setTestScenarioLabel(null);audio.unlock();}},
  save(){const result=session.save();ui.notify(result.message);ui.setSavedAvailable(session.hasSave());},
  service(action){if(session.state){const result=serviceAction(session.state,action);ui.notify(result.message);keys.clear();accumulator=0;}},
  settings(change){session.setSettings(change);if(change.sound)audio.unlock();},
  route(){/* physical steering chooses the ramp; retained UI callback for old callers */},
  enterService(){if(session.state&&enterService(session.state)){keys.clear();accumulator=0;}},
};
const ui=new GameUI(document.querySelector<HTMLDivElement>('#app')!,actions);
renderer=new GameRenderer(ui.canvas);ui.setSavedAvailable(session.hasSave());

function navigateMenu(direction:number):void {
  const dialog=document.querySelector<HTMLDialogElement>('dialog[open]');
  const scope=dialog??document;
  const items=Array.from(scope.querySelectorAll<HTMLElement>('button:not(:disabled),select,input'))
    .filter(item=>item.offsetParent!==null&&!item.closest('[hidden]'));
  if(!items.length)return;
  const current=items.indexOf(document.activeElement as HTMLElement);
  items[(current+direction+items.length)%items.length].focus();
}
let lastFrame=performance.now(),lastMenuAxis=0;
let stats:RenderStats={frameMs:0,objects:0,mirrorObjects:0};
const samples:{frameMs:number;renderMs:number;resolution:string}[]=[];
function frame(now:number):void {
  const realDelta=Math.min(.1,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
  const pad=Array.from(navigator.getGamepads?.()??[]).find(p=>p?.connected)??null;
  const gamepad=pads.read(pad),state=session.state;
  const uiOpen=!!document.querySelector('dialog[open]')||!state;
  const pauseMenu=document.querySelector<HTMLElement>('.panel-paused:not([hidden])');
  if(keys.take('Escape')||keys.take('KeyP')||(gamepad.pressed.has(9)&&(!uiOpen||pauseMenu))){
    if(state?.status==='driving')actions.pause();else if(state?.status==='paused')actions.resume();
  }
  if(keys.take('KeyC')||gamepad.pressed.has(2))actions.settings({view:session.settings.view==='arcade'?'cockpit':'arcade'});
  if(keys.take('KeyM')||gamepad.pressed.has(3))actions.settings({map:!session.settings.map});
  if(uiOpen&&gamepad.connected){
    if(gamepad.pressed.has(12))navigateMenu(-1);if(gamepad.pressed.has(13))navigateMenu(1);
    if(gamepad.pressed.has(0)){
      const focused=document.activeElement;
      if(focused instanceof HTMLButtonElement||(focused instanceof HTMLInputElement&&focused.type==='checkbox'))focused.click();
      else if(!state)document.querySelector<HTMLButtonElement>('.start-drive')?.click();
    }
    const axis=pad?.axes[0]??0;
    if(Math.abs(axis)>.7&&Math.abs(lastMenuAxis)<=.7){
      const focused=document.activeElement;
      if(focused instanceof HTMLSelectElement){focused.selectedIndex=Math.max(0,Math.min(focused.options.length-1,focused.selectedIndex+Math.sign(axis)));focused.dispatchEvent(new Event('change',{bubbles:true}));}
    }
    lastMenuAxis=axis;
  }
  // A menu action may change status to driving. Never reuse the same edge on the road.
  if(state?.status==='driving'&&!uiOpen){
    if(keys.take('KeyR')||gamepad.pressed.has(5))shiftGear(state,1);
    if(keys.take('KeyQ')||gamepad.pressed.has(4))shiftGear(state,-1);
    if(keys.take('KeyE')||gamepad.pressed.has(0))actions.enterService();
    const keyboard=keys.read();
    const input={throttle:Math.max(keyboard.throttle,gamepad.input.throttle),brake:Math.max(keyboard.brake,gamepad.input.brake),steer:Math.abs(gamepad.input.steer)>.05?gamepad.input.steer:keyboard.steer};
    accumulator+=realDelta;
    while(accumulator>=1/60){session.step(input,1/60);accumulator-=1/60;}
  }else accumulator=0;
  if(session.state)stats=renderer.render(session.state,session.settings);
  else {renderer.resize(session.settings.resolution);renderer.drawPreview('steinbach',now/1000);}
  ui.update(session.state,session.settings,stats);audio.update(session.state,session.settings);
  if(session.state?.status==='driving'){
    samples.push({frameMs:realDelta*1000,renderMs:stats.frameMs,resolution:session.settings.resolution});
    if(samples.length>1800)samples.shift();
  }
  requestAnimationFrame(frame);
}
window.addEventListener('blur',()=>{keys.clear();session.pause();accumulator=0;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();session.pause();accumulator=0;}});
if(import.meta.env.DEV){
  Object.defineProperty(window,'__cannonball',{value:{
    getState:()=>structuredClone(session.state),getSettings:()=>({...session.settings}),
    getTestScenario:()=>session.testScenario,
    performance:()=>structuredClone(samples),getRenderStats:()=>({...stats}),
  },configurable:true});
}
requestAnimationFrame(frame);
