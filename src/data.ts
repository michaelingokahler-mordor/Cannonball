import type { CrewDef, ServiceDef, VehicleDef } from './model.ts';
export const STAGE_LENGTH = 360_000;
export const TIME_SCALE = 8;
export const BRANCH = { start: 101_200, decision: 102_000, end: 156_000, divergence: 1000, rejoin: 1200, separation: 70, progressFactor: 0.78 } as const;
// Balancing values, not claims about stock or historical record cars.
const base = { fatigue: 1, wear: 1, robustness: 80, prototype: false };
export const VEHICLES: VehicleDef[] = [
  {...base,id:'vittoria',name:'Vittoria GT12',family:'Gran Turismo',reference:'Ferrari 365 GTB/4',color:'#b14a31',body:'sports',transmission:'manual',gears:5,gearSpeeds:[72,120,170,225,275],maxSpeed:275,acceleration:38,handling:1.02,tank:115,consumption:19,fatigue:1.1,wear:1.2},
  {...base,id:'piccola',name:'Vittoria Piccola',family:'Gran Turismo',reference:'Dino 246 GTS',color:'#d8b24b',body:'sports',transmission:'manual',gears:5,gearSpeeds:[60,100,145,190,230],maxSpeed:230,acceleration:35,handling:1.15,tank:70,consumption:14,unlockAfter:'vittoria'},
  {...base,id:'rambler',name:'Prairie Rambler',family:'Road & Home',reference:'Chevrolet Sportvan 1971, manual option',color:'#b47b45',body:'van',transmission:'manual',gears:3,gearSpeeds:[65,110,170],maxSpeed:170,acceleration:19,handling:.8,tank:160,consumption:23,fatigue:.75,robustness:88},
  {...base,id:'roadnest',name:'Roadnest 73',family:'Road & Home',reference:'Travco on Dodge chassis, 1973',color:'#ded2af',body:'rv',transmission:'automatic',gears:3,gearSpeeds:[43,78,115],maxSpeed:115,acceleration:12,handling:.65,tank:220,consumption:27,fatigue:.6,wear:1.2,unlockAfter:'rambler'},
  {...base,id:'hohenfels',name:'Hohenfels 690',family:'Continental',reference:'Mercedes 450 SEL 6.9',color:'#47766c',body:'sedan',transmission:'automatic',gears:3,gearSpeeds:[82,145,225],maxSpeed:225,acceleration:28,handling:.98,tank:100,consumption:18,fatigue:.68,wear:1.12,robustness:90,prototype:true,eyeHeight:1.25},
  {...base,id:'kingsbridge',name:'Kingsbridge Twelve',family:'Continental',reference:'Jaguar XJ-S V12 US 1978',color:'#455774',body:'sports',transmission:'automatic',gears:3,gearSpeeds:[80,150,240],maxSpeed:240,acceleration:32,handling:1.06,tank:95,consumption:20,fatigue:.75,unlockAfter:'hohenfels'},
  {...base,id:'steinbach',name:'Steinbach Turbo',family:'Autobahn',reference:'Porsche 930 Turbo 3.0 1975',color:'#c87835',body:'sports',transmission:'manual',gears:4,gearSpeeds:[77,130,190,255],maxSpeed:255,acceleration:39,handling:1.13,tank:85,consumption:16,fatigue:1.15,wear:1.2,prototype:true,eyeHeight:.9},
  {...base,id:'rhein',name:'Steinbach Rhein',family:'Autobahn',reference:'Porsche 928 automatic, late 1970s',color:'#c5bda4',body:'sports',transmission:'automatic',gears:3,gearSpeeds:[85,150,230],maxSpeed:230,acceleration:30,handling:1.04,tank:95,consumption:17,fatigue:.72,unlockAfter:'steinbach'},
  {...base,id:'torosv',name:'Cuneo Toro SV',family:'Exotica',reference:'Lamborghini Miura SV',color:'#a6a14e',body:'sports',transmission:'manual',gears:5,gearSpeeds:[75,125,180,230,280],maxSpeed:280,acceleration:39,handling:1.12,tank:90,consumption:21,fatigue:1.2,wear:1.25},
  {...base,id:'cuneo',name:'Cuneo S',family:'Exotica',reference:'Lamborghini Countach LP400 S',color:'#b8a379',body:'sports',transmission:'manual',gears:5,gearSpeeds:[75,130,185,235,285],maxSpeed:285,acceleration:41,handling:1.02,tank:100,consumption:22,fatigue:1.3,wear:1.35,unlockAfter:'torosv'},
];
type CrewType = Omit<CrewDef,'id'|'name'|'gender'>;
const types: {ids:[string,string];names:[string,string];def:CrewType}[] = [
  {ids:['jack','june'],names:['Jack Mercer','June Mercer'],def:{archetype:'pro',title:'Rennprofi',description:'Ruhige Hände. Ein Auge auf der Ideallinie, das andere am Drehzahlmesser.',strength:'Mehr Kontrolle bei hohem Tempo',weakness:'Wird schneller müde',color:'#b46439',fatigue:1.14,fuel:1,acceleration:1,handling:1.18,repair:1,navigation:1,stress:1}},
  {ids:['lou','lucy'],names:['Lou Bennett','Lucy Bennett'],def:{archetype:'economist',title:'Sparfahrer',description:'Kennt jede Tanknadel zwischen New York und dem Pazifik.',strength:'14 % weniger Verbrauch',weakness:'Sanftere Beschleunigung',color:'#828b4b',fatigue:1,fuel:.86,acceleration:.9,handling:1,repair:1,navigation:1,stress:1}},
  {ids:['hank','helen'],names:['Hank Brooks','Helen Brooks'],def:{archetype:'endurance',title:'Dauerfahrer',description:'Ein langer Highway ist für andere eine Strecke. Für Brooks ein guter Abend.',strength:'25 % weniger Ermüdung',weakness:'Spätere Streckenhinweise',color:'#647e8a',fatigue:.75,fuel:1,acceleration:1,handling:1,repair:1,navigation:.8,stress:1}},
  {ids:['eddie','eve'],names:['Eddie Shaw','Eve Shaw'],def:{archetype:'mechanic',title:'Mechaniker',description:'Kann einen schiefen Motorlauf hören, bevor die Warnlampe es weiß.',strength:'Kürzere Werkstattaufenthalte',weakness:'Mehr Stress bei Verfolgungen',color:'#967956',fatigue:1,fuel:1,acceleration:1,handling:1,repair:.72,navigation:1,stress:1.3}},
  {ids:['miles','rose'],names:['Miles Carter','Rose Carter'],def:{archetype:'navigator',title:'Navigator',description:'Die Karte ist gefaltet. Der nächste Abzweig längst gefunden.',strength:'Frühere Kurven- und Streckenansagen',weakness:'Weniger Ausdauer am Steuer',color:'#ad745d',fatigue:1.15,fuel:1,acceleration:1,handling:1,repair:1,navigation:1.5,stress:1}},
  {ids:['duke','daisy'],names:['Duke Wilder','Daisy Wilder'],def:{archetype:'daredevil',title:'Draufgänger',description:'Würde selbst an einem schnurgeraden Highway noch eine Abkürzung suchen.',strength:'Kräftigere Beschleunigung',weakness:'Mehr Verbrauch und Verschleiß',color:'#aa4d42',fatigue:1.05,fuel:1.12,acceleration:1.12,handling:1.08,repair:1,navigation:1,stress:.9}},
];
export const CREW: CrewDef[] = types.flatMap(t=>t.ids.map((id,i)=>({...t.def,id,name:t.names[i],gender:i===0?'m' as const:'f' as const})));
export const SERVICES: ServiceDef[] = [
  {id:'sundown',name:'Sundown Gas',kind:'fuel',distance:45000,description:'Benzin, ein kurzer Halt und ein frisches Gesicht am Steuer.'},
  {id:'miller',name:'Miller’s Garage',kind:'garage',distance:115000,description:'Tanken, Reifen und Reparaturen. Ein fester Zeitaufschlag statt Wartezeit.'},
  {id:'bluebird',name:'Bluebird Diner',kind:'diner',distance:185000,description:'Warmer Kaffee, etwas zu essen und eine ordentliche Rast.'},
  {id:'keystone',name:'Keystone Truckstop',kind:'truckstop',distance:255000,description:'Volle Versorgung zwischen den Bergen und der Staatsgrenze.'},
  {id:'lastchance',name:'Last Chance Service',kind:'fuel',distance:315000,description:'Der letzte sichere Halt vor Ohio.'},
];
export const ROUTE_STATES: {id:string;name:string;short:string;available:boolean}[] = [
  ['ny','New York','NY'],['nj','New Jersey','NJ'],['pa','Pennsylvania','PA'],['oh','Ohio','OH'],['in','Indiana','IN'],['il','Illinois','IL'],['mo','Missouri','MO'],['ks','Kansas','KS'],['ok','Oklahoma','OK'],['tx','Texas','TX'],['nm','New Mexico','NM'],['az','Arizona','AZ'],['ca','California','CA'],
].map(([id,name,short])=>({id,name,short,available:id==='pa'}));
export function getVehicle(id:string):VehicleDef { return VEHICLES.find(v=>v.id===id)??VEHICLES.find(v=>v.id==='steinbach')!; }
export function getCrew(id:string):CrewDef { return CREW.find(c=>c.id===id)??CREW[0]; }
