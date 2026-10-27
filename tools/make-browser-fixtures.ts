import {mkdirSync,writeFileSync} from 'node:fs';
import {createRun,enterService,serializeRun} from '../src/simulation.ts';
import {SERVICES} from '../src/data.ts';
mkdirSync('output/qa',{recursive:true});
const state=createRun({seed:42});state.distance=SERVICES[0].distance;state.x=1.75;state.speed=0;
if(!enterService(state))throw new Error('Fixture must enter a real valid service');
const raw=serializeRun(state);if(!raw)throw new Error('Invalid fixture');
writeFileSync('output/qa/service-save.json',raw);
