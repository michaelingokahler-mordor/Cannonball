import test from 'node:test';
import assert from 'node:assert/strict';
import {KeyboardInput,GamepadInput} from '../src/input.ts';
function key(target:EventTarget,type:string,code:string){target.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),{code,repeat:false}));}
test('held keyboard input is continuous but a shift edge only occurs once per physical press',()=>{
  const target=new EventTarget(),input=new KeyboardInput(target);
  key(target,'keydown','KeyW');key(target,'keydown','KeyR');
  assert.equal(input.read().throttle,1);assert.equal(input.take('KeyR'),true);assert.equal(input.take('KeyR'),false);
  key(target,'keydown','KeyR');assert.equal(input.take('KeyR'),false);
  key(target,'keyup','KeyR');key(target,'keydown','KeyR');assert.equal(input.take('KeyR'),true);
  input.dispose();
});
test('losing focus releases throttle and all pending actions',()=>{
  const target=new EventTarget(),input=new KeyboardInput(target);key(target,'keydown','ArrowUp');key(target,'keydown','KeyQ');
  target.dispatchEvent(new Event('blur'));assert.equal(input.read().throttle,0);assert.equal(input.take('KeyQ'),false);input.dispose();
});
test('gamepad trigger values, stick deadzone and button edges stay bounded and reset on disconnect',()=>{
  const input=new GamepadInput();const pad={axes:[.04],buttons:Array.from({length:16},()=>({value:0,pressed:false,touched:false}))};
  pad.buttons[7]={value:.7,pressed:true,touched:true};pad.buttons[5]={value:1,pressed:true,touched:true};
  const first=input.read(pad);assert.equal(first.input.throttle,.7);assert.equal(first.input.steer,0);assert.equal(first.pressed.has(5),true);
  assert.equal(input.read(pad).pressed.has(5),false);input.read(null);assert.equal(input.read(pad).pressed.has(5),true);
});
