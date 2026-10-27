import type { InputState } from './model.ts';
export class KeyboardInput {
  private keys=new Set<string>();
  private edges=new Set<string>();
  private target:EventTarget;
  private keydown=(event:Event)=>{
    const e=event as KeyboardEvent;
    if(typeof HTMLElement!=='undefined'&&e.target instanceof HTMLElement&&['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
    if(!this.keys.has(e.code))this.edges.add(e.code);
    this.keys.add(e.code);
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  };
  private keyup=(event:Event)=>{this.keys.delete((event as KeyboardEvent).code);};
  private blur=()=>this.clear();
  constructor(target:EventTarget){
    this.target=target;target.addEventListener('keydown',this.keydown);target.addEventListener('keyup',this.keyup);target.addEventListener('blur',this.blur);
  }
  read():InputState{
    return {throttle:this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0,
      brake:this.keys.has('KeyS')||this.keys.has('ArrowDown')||this.keys.has('Space')?1:0,
      steer:(this.keys.has('ArrowRight')||this.keys.has('KeyD')?1:0)-(this.keys.has('ArrowLeft')||this.keys.has('KeyA')?1:0)};
  }
  take(code:string):boolean { const present=this.edges.has(code);this.edges.delete(code);return present; }
  clear():void{this.keys.clear();this.edges.clear();}
  dispose():void{this.target.removeEventListener('keydown',this.keydown);this.target.removeEventListener('keyup',this.keyup);this.target.removeEventListener('blur',this.blur);this.clear();}
}
export class GamepadInput {
  private previous=new Set<number>();
  read(pad:Pick<Gamepad,'axes'|'buttons'>|null):{input:InputState;pressed:Set<number>;connected:boolean}{
    const pressed=new Set<number>();
    if(!pad){this.previous.clear();return {input:{throttle:0,brake:0,steer:0},pressed,connected:false};}
    const now=new Set<number>();
    pad.buttons.forEach((b,i)=>{if(b.pressed||b.value>.55){now.add(i);if(!this.previous.has(i))pressed.add(i);}});
    this.previous=now;
    const axis=Number.isFinite(pad.axes[0])?Math.max(-1,Math.min(1,pad.axes[0])):0;
    const steer=Math.abs(axis)<=.12?0:Math.sign(axis)*(Math.abs(axis)-.12)/.88;
    const trigger=(index:number)=>{const v=pad.buttons[index]?.value??0;return Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;};
    return {input:{throttle:trigger(7),brake:trigger(6),steer},pressed,connected:true};
  }
}
