import type { ActionResult, InputState, RunOptions, RunState, TestScenarioId, ViewSettings } from './model.ts';
import { createRun, updateRun, serializeRun, restoreRun } from './simulation.ts';
import { createTestRun } from './test-scenarios.ts';

export interface StoragePort { getItem(key:string):string|null; setItem(key:string,value:string):void }
export const SAVE_KEY='cannonball.pa.save.v1';
export const SETTINGS_KEY='cannonball.pa.settings.v1';
export const DEFAULT_SETTINGS:ViewSettings={view:'arcade',resolution:'640x360',map:false,units:'kmh',sound:true,speech:false};
function cleanSettings(value:unknown):ViewSettings {
  const clean={...DEFAULT_SETTINGS};
  if(!value||typeof value!=='object'||Array.isArray(value))return clean;
  const v=value as Record<string,unknown>;
  if(v.view==='arcade'||v.view==='cockpit')clean.view=v.view;
  if(v.resolution==='640x360'||v.resolution==='1280x720')clean.resolution=v.resolution;
  else if(v.resolution==='960x540')clean.resolution='1280x720';
  if(v.units==='kmh'||v.units==='mph')clean.units=v.units;
  for(const key of ['map','sound','speech'] as const)if(typeof v[key]==='boolean')clean[key]=v[key];
  return clean;
}
export function readSettings(storage:StoragePort|null):ViewSettings {
  try{return cleanSettings(JSON.parse(storage?.getItem(SETTINGS_KEY)??'null'));}
  catch{return {...DEFAULT_SETTINGS};}
}
export class GameSession {
  state:RunState|null=null;
  testScenario:TestScenarioId|null=null;
  settings:ViewSettings;
  private storage:StoragePort|null;
  constructor(storage:StoragePort|null){ this.storage=storage; this.settings=readSettings(storage); }
  start(options:RunOptions={}):void { const state=createRun(options);this.state=state;this.testScenario=null; }
  startTest(id:TestScenarioId,options:RunOptions={}):void { const state=createTestRun(id,options);this.state=state;this.testScenario=id; }
  step(input:InputState,dt:number):void { if(this.state)updateRun(this.state,input,dt); }
  setSettings(patch:Partial<ViewSettings>):void {
    this.settings=cleanSettings({...this.settings,...patch});
    try{this.storage?.setItem(SETTINGS_KEY,JSON.stringify(this.settings));}catch{/* session settings remain usable */}
  }
  pause():void { if(this.state?.status==='driving')this.state.status='paused'; }
  resume():void { if(this.state?.status==='paused')this.state.status='driving'; }
  save():ActionResult {
    if(this.testScenario)return {ok:false,message:'Testfahrten werden nicht gespeichert. Dein bestehender Spielstand bleibt erhalten.'};
    if(!this.state)return {ok:false,message:'Es läuft noch keine Fahrt.'};
    const raw=serializeRun(this.state);
    if(!raw)return {ok:false,message:'Speichern geht nur an einer sicheren Servicestelle.'};
    if(!this.storage)return {ok:false,message:'Lokaler Speicher ist nicht verfügbar. Diese Fahrt ist nicht gesichert.'};
    try{this.storage.setItem(SAVE_KEY,raw);return {ok:true,message:'Fahrt an der Servicestelle gespeichert.'};}
    catch{return {ok:false,message:'Speichern fehlgeschlagen. Bitte Browser-Speicher prüfen; die Fahrt läuft weiter.'};}
  }
  load():ActionResult {
    try{
      const raw=this.storage?.getItem(SAVE_KEY);
      const restored=raw?restoreRun(raw):null;
      if(!restored)return {ok:false,message:'Kein gültiger Pennsylvania-Spielstand vorhanden.'};
      this.state=restored;
      this.testScenario=null;
      return {ok:true,message:'Gesicherte Fahrt wiederhergestellt. Willkommen zurück!'};
    }catch{return {ok:false,message:'Der lokale Spielstand konnte nicht gelesen werden.'};}
  }
  hasSave():boolean {
    try{const raw=this.storage?.getItem(SAVE_KEY);return !!raw&&restoreRun(raw)!==null;}
    catch{return false;}
  }
}
