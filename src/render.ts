import type { RenderStats, Resolution, RoadSample, RouteChoice, RunState, ServiceKind, ViewSettings } from './model.ts';
import { BRANCH, CREW, SERVICES, STAGE_LENGTH, getVehicle } from './data.ts';
import { getRoadSample } from './road.ts';
import { getRoadHalfWidth, getRouteOffset, getServiceLayout } from './layout.ts';
import { PAL, building, car, hash, pixelText, poly, rect, roadSign, tree, vehicleHalfWidth } from './art.ts';
import { mapRoutePoint } from './route-map.ts';

type Ctx = CanvasRenderingContext2D;
interface Projection { d: number; x: number; y: number; scale: number; half: number; sample: RoadSample; clip: number }
interface Viewport { x: number; y: number; w: number; h: number; reverse: boolean; mirror?: boolean }
const DEPTH = 6200;
const ARCADE_CAMERA_BACK = 42;
const CURVE_SCALE = .00012;
const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};

/** Presentation only: all motion and all random choices belong to the simulation. */
export class GameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: Ctx;
  private resolution: Resolution = '640x360';
  private frameObjects = 0;
  private mirrorObjects = 0;
  private currentView: 'arcade' | 'cockpit' = 'arcade';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas 2D wird von diesem Browser nicht unterstützt.');
    this.ctx = context;
    this.resize(this.resolution);
  }
  resize(resolution: Resolution): void {
    this.resolution = resolution;
    const [width, height] = resolution.split('x').map(Number);
    this.canvas.width = width; this.canvas.height = height;
    this.ctx.imageSmoothingEnabled = false;
    this.canvas.style.imageRendering = 'pixelated';
  }
  render(state: RunState, settings: ViewSettings): RenderStats {
    const start = performance.now();
    if (settings.resolution !== this.resolution) this.resize(settings.resolution);
    const c = this.ctx;
    c.setTransform(this.canvas.width / 640, 0, 0, this.canvas.height / 360, 0, 0);
    c.imageSmoothingEnabled = false;
    this.frameObjects = 0; this.mirrorObjects = 0;
    this.currentView = settings.view;
    c.clearRect(0, 0, 640, 360);
    if (settings.view === 'cockpit') {
      this.world(state, { x: 0, y: 0, w: 640, h: 281, reverse: false });
      this.cockpit(state, settings);
      this.mirror(state, 435, 40, 185, 43, true);
    } else {
      this.world(state, { x: 0, y: 0, w: 640, h: 360, reverse: false });
      const v = getVehicle(state.vehicleId);
      const ps=this.projections(state,360,false,state.route),p=this.projectAt(ps,ARCADE_CAMERA_BACK,state.x*1.125);
      if(p)car(c,p.x,p.y,p.scale*720*vehicleHalfWidth(v.body),v.color,v.body,'rear',state.x*.4);
      this.mirror(state, 448, 41, 175, 55, false);
      this.arcadeHud(state, settings);
    }
    this.commonHud(state, settings);
    if (settings.map) this.paperMap(state);
    return { frameMs: performance.now() - start, objects: this.frameObjects, mirrorObjects: this.mirrorObjects };
  }

  private sky(state: RunState, h: number, mirror: boolean, reverse: boolean): void {
    const c = this.ctx, horizon = this.horizon(h, mirror);
    if(getRoadSample(state.distance,state.route).theme==='tunnel') {
      rect(c,'#263d3c',0,0,640,h);return;
    }
    const sky = c.createLinearGradient(0, 0, 0, horizon + 20);
    sky.addColorStop(0, '#568f9b'); sky.addColorStop(.65, '#c3bd9a'); sky.addColorStop(1, '#ecd19b');
    c.fillStyle = sky; c.fillRect(0, 0, 640, h);
    if (!mirror) {
      rect(c, '#f3d69a', 83, 42, 29, 16); rect(c, '#f3d69a', 77, 46, 41, 8);
      for (let n = 0; n < 7; n++) {
        const cx = (n * 121 + (reverse ? 31 : 0)) % 700 - 20;
        rect(c, '#dad1ae', cx, 25 + hash(n + 8) * 50, 47 + hash(n + 2) * 37, 3);
        rect(c, '#dad1ae', cx + 12, 21 + hash(n + 8) * 50, 32, 3);
      }
    }
    const road = getRoadSample(state.distance, state.route);
    const ridge = road.theme === 'ridge' ? 1.6 : 1;
    for (let layer = 0; layer < 3; layer++) {
      const pts = [-20, horizon + 36];
      const shift = Math.sin(state.distance / 50000) * 16 * (layer + 1);
      for (let x = -20; x <= 670; x += 10) {
        const y = horizon - (Math.sin((x + shift) * .013 + layer * 2) * 9 + Math.sin(x * .032 + layer) * 4 + 16 + layer * 8) * ridge;
        pts.push(x, y);
      }
      pts.push(680, horizon + 40);
      poly(c, ['#7a9690', '#5e8278', '#466c5d'][layer], pts);
    }
    const ground = road.theme === 'town' ? '#7e8861' : road.theme === 'ridge' ? '#89956b' : '#9a9c67';
    rect(c, ground, 0, horizon + 3, 640, h);
  }

  private horizon(h:number,mirror=false):number { return h*(this.currentView==='cockpit'?(mirror?.42:.46):.365); }
  private cameraDistance(state:RunState,reverse:boolean,mirror=false):number {
    return state.distance-(!reverse&&!mirror&&this.currentView==='arcade'?ARCADE_CAMERA_BACK:0);
  }
  private projections(state: RunState, h: number, reverse: boolean, route:RouteChoice='main', mirror=false): Projection[] {
    const horizon = this.horizon(h,mirror);
    const origin=this.cameraDistance(state,reverse,mirror);
    const baseHeight = getRoadSample(origin, state.route).height;
    const slopeStart=Math.max(0,origin-30),slopeEnd=Math.min(STAGE_LENGTH,origin+30);
    const roadSlope=(getRoadSample(slopeEnd,state.route).height-getRoadSample(slopeStart,state.route).height)/Math.max(1,slopeEnd-slopeStart);
    const v=getVehicle(state.vehicleId);
    const eye=this.currentView==='cockpit'?(v.eyeHeight??({sports:.9,sedan:1.25,van:1.85,rv:2.15}[v.body])):7;
    const playerOffset=getRouteOffset(state.distance,state.route)+state.x;
    // Turn smoothly into the selected branch; at the nose both coordinate frames
    // still coincide. Later the unchosen highway leaves the forward view.
    const align=state.route==='detour'?smooth((state.distance-BRANCH.decision)/100):0;
    let bend = 0, center = 0, clip = h;
    const out: Projection[] = [];
    let previous=0;
    for (let d = .7; d <= DEPTH; d += Math.max(2,d*.065)) {
      const world=Math.max(0,origin+(reverse?-d:d));
      const sample = getRoadSample(world, route);
      const step=d-previous;previous=d;
      bend += sample.curve * step * CURVE_SCALE * (reverse ? -1 : 1);
      center += bend * step;
      const scale = 23.8 / d;
      const turn=align*(getRouteOffset(world,state.route)-getRouteOffset(state.distance,state.route));
      const lateral=(getRouteOffset(world,route)-playerOffset-turn)*(reverse?-1:1);
      const x = 320 + (center + lateral*1.125) * scale * 320;
      const heightDelta=sample.height-baseHeight-roadSlope*(reverse?-d:d);
      const y = horizon + (eye*50 - heightDelta*50) * (h / 360) * scale;
      out.push({ d, x, y, scale, half: scale * 360*getRoadHalfWidth(world,route), sample, clip });
      clip = Math.min(clip, y);
    }
    return out;
  }

  private projectAt(proj: Projection[], d: number, lateral = 0): Projection | null {
    if (d < proj[0].d || d > proj[proj.length-1].d) return null;
    let lo=0,hi=proj.length-1;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(proj[mid].d<=d)lo=mid;else hi=mid;}
    const a=proj[lo],b=proj[hi],t=(d-a.d)/(b.d-a.d);
    const scale = a.scale + (b.scale - a.scale) * t;
    return { ...a, d, scale, x: a.x + (b.x - a.x) * t + lateral * scale * 320, y: a.y + (b.y - a.y) * t, half: a.half+(b.half-a.half)*t };
  }
  private routeVisible(distance:number,route:RouteChoice,selected:RouteChoice):boolean {
    const apart=distance>BRANCH.decision+BRANCH.divergence&&distance<BRANCH.end-BRANCH.rejoin;
    return !apart||route===selected;
  }
  private spriteVisible(p:Projection,width:number,h:number,viewportWidth:number):boolean {
    return width>=2&&width*viewportWidth/640>=2&&p.x+width*.6>=0&&p.x-width*.6<=640&&p.y+width*.04>=0&&p.y-width*1.12<h&&p.y<=p.clip+4;
  }

  private world(state: RunState, vp: Viewport): void {
    const c = this.ctx;
    const origin=this.cameraDistance(state,vp.reverse,!!vp.mirror),cameraState={...state,distance:origin};
    c.save(); c.beginPath(); c.rect(vp.x, vp.y, vp.w, vp.h); c.clip();
    c.translate(vp.x, vp.y); c.scale(vp.w / 640, vp.h / (vp.mirror ? 190 : vp.h));
    const h = vp.mirror ? 190 : vp.h;
    this.sky(state, h, !!vp.mirror, vp.reverse);
    const ps = this.projections(state, h, vp.reverse,'main',!!vp.mirror);
    const detour=this.projections(state,h,vp.reverse,'detour',!!vp.mirror);
    const direction = vp.reverse ? -1 : 1;
    const bleed=vp.mirror?2:0;
    for (let i = ps.length - 2; i >= 0; i--) {
      const a = ps[i], b = ps[i + 1];
      if (a.y <= b.y || b.y >= b.clip + .5) continue;
      const alt = Math.floor((origin + direction * a.d) / 85) % 2 === 0;
      const groundSample=getRoadSample(origin+direction*a.d,state.route);
      const ga=state.route==='detour'?detour[i]:a,gb=state.route==='detour'?detour[i+1]:b;
      const grass = groundSample.theme==='tunnel'?'#7e8272':groundSample.theme === 'forest' ? (alt ? '#7c8d5d' : '#829361') : alt ? '#a5a16c' : '#a09d65';
      poly(c, grass, [0,b.y,640,b.y,640,a.y,0,a.y]);
      if(groundSample.theme==='farmland') {
        const field=Math.floor((origin+direction*a.d)/1900);
        for(const side of [-1,1]) {
          const fieldCol=['#b2a168','#a9a36b','#899267','#b5a570'][Math.abs(field+side)%4];
          const inside=1.85+(Math.abs(field)%3)*.35;
          poly(c,fieldCol,[ga.x+side*ga.half*inside,ga.y,gb.x+side*gb.half*inside,gb.y,gb.x+side*gb.half*18,gb.y,ga.x+side*ga.half*18,ga.y]);
          if(i%2===0)for(let row=3;row<15;row+=2) this.roadLine(ga,gb,side*row,.018,'#a29c65');
        }
      }
      if(!this.routeVisible(origin+direction*a.d,'main',state.route))continue;
      if (a.sample.theme === 'town') {
        poly(c,'#adad8e',[a.x-a.half*1.44,a.y,b.x-b.half*1.44,b.y,b.x+b.half*1.44,b.y,a.x+a.half*1.44,a.y]);
      }
      poly(c,alt?'#bcb898':'#c5bc95',[a.x-a.half*1.13,a.y,b.x-b.half*1.13,b.y,b.x+b.half*1.13,b.y,a.x+a.half*1.13,a.y]);
      const worldD=origin+direction*a.d;
      const bridge=worldD>33600&&worldD<34250;
      const roadCol = bridge ? '#7b8070' : a.sample.rough ? alt ? '#696c60' : '#6f7062' : alt ? '#586564' : '#5c6967';
      poly(c,roadCol,[a.x-a.half,a.y+bleed,b.x-b.half,b.y-bleed,b.x+b.half,b.y-bleed,a.x+a.half,a.y+bleed]);
      this.roadLine(a,b,-.96,.012,'#e0d4ad'); this.roadLine(a,b,.96,.012,'#e0d4ad');
      this.roadLine(a,b,-.025,.007,'#e0b961'); this.roadLine(a,b,.025,.007,'#e0b961');
      if(bridge||a.sample.theme==='ridge')for(const side of [-1,1]) {
        const ah=a.scale*23,bh=b.scale*23;
        poly(c,'#adb79c',[a.x+side*a.half*1.09,a.y-ah,b.x+side*b.half*1.09,b.y-bh,b.x+side*b.half*1.09,b.y-bh+Math.max(.5,b.scale*4),a.x+side*a.half*1.09,a.y-ah+Math.max(.5,a.scale*4)]);
        if(i%3===0)rect(c,'#677c6d',a.x+side*a.half*1.09,a.y-ah,Math.max(1,a.scale*3),ah);
      }
      if(a.sample.rough && i % 4 === 0) {
        this.roadLine(a,b,.23,.015,'#62695c'); this.roadLine(a,b,-.71,.008,'#818377');
      }
    }
    for(let i=ps.length-2;i>=0;i--) {
      const world=origin+direction*ps[i].d;
      if(world<BRANCH.start||world>=BRANCH.end)continue;
      if(!this.routeVisible(world,'detour',state.route))continue;
      const a=detour[i],b=detour[i+1];
      if(a.y<=b.y||b.y>b.clip+.5)continue;
      poly(c,'#b9b38f',[a.x-a.half*1.08,a.y,b.x-b.half*1.08,b.y,b.x+b.half*1.08,b.y,a.x+a.half*1.08,a.y]);
      poly(c,'#65716a',[a.x-a.half,a.y,b.x-b.half,b.y,b.x+b.half,b.y,a.x+a.half,a.y]);
      this.roadLine(a,b,-.95,.015,'#e0d4ad');this.roadLine(a,b,.95,.015,'#e0d4ad');
      this.roadLine(a,b,0,.012,'#d5b268');
    }
    for(const stop of SERVICES)this.serviceGround(cameraState,ps,stop.id,vp.reverse);
    const stripeStart=Math.floor((origin+(vp.reverse?-DEPTH:0))/80);
    const stripeEnd=Math.ceil((origin+(vp.reverse?0:DEPTH))/80);
    for(let mark=stripeStart;mark<=stripeEnd;mark++) {
      if(!this.routeVisible(mark*80,'main',state.route))continue;
      const ends=[(mark*80-origin)*direction,((mark*80+30)-origin)*direction].sort((a,b)=>a-b);
      const a=this.projectAt(ps,Math.max(ps[0].d,ends[0])),b=this.projectAt(ps,ends[1]);
      if(!a||!b||ends[1]<ps[0].d||b.y>b.clip+1||a.y<=b.y)continue;
      this.roadLine(a,b,-.5,.009,'#d4d1af');this.roadLine(a,b,.5,.009,'#d4d1af');
    }
    type Draw = { d: number; draw: () => void };
    const drawables: Draw[] = [];
    const startWorld = origin + (vp.reverse ? -DEPTH : 0);
    const endWorld = origin + (vp.reverse ? 0 : DEPTH);
    const first = Math.floor(startWorld / 105);
    const last = Math.ceil(endWorld / 105);
    for(let n=first;n<=last;n++) {
      const world = n*105;
      if(world<0) continue;
      const d = (world-origin)*direction;
      const sceneryPs=state.route==='detour'?detour:ps;
      const p=this.projectAt(sceneryPs,d); if(!p || p.y>p.clip+3)continue;
      if(p.sample.theme==='tunnel')continue;
      for(const side of [-1,1]) {
        const r = hash(n*13+side*7);
        const theme = p.sample.theme;
        const dist=1.55+r*3.6;
        const absoluteX=getRouteOffset(world,state.route)+side*dist/1.125;
        const farmBuilding=n%3===0&&theme==='farmland'&&r>.45;
        const townBuilding=theme==='town'&&n%2===0;
        if(!this.sceneryClear(world,absoluteX,farmBuilding?.82:townBuilding?.65:.4))continue;
        const pos=this.projectAt(sceneryPs,d,side*dist); if(!pos)continue;
        const scale = pos.scale * 3.4;
        if(n%3===0 && theme==='farmland' && r>.45) {
          drawables.push({d,draw:()=>building(c,pos.x,pos.y,scale*.86,n%2===0?'barn':'house')});
        } else if (theme==='town' && n%2===0) {
          drawables.push({d,draw:()=>building(c,pos.x,pos.y,scale,'house')});
        } else {
          drawables.push({d,draw:()=>tree(c,pos.x,pos.y,(56+r*39)*scale,n,p.sample.theme==='forest'||p.sample.theme==='ridge')});
          if(theme==='forest') {
            const backWorld=world+direction*15;
            const backX=getRouteOffset(backWorld,state.route)+side*(dist+2)/1.125;
            const back=this.projectAt(sceneryPs,d+15,side*(dist+2));
            if(back&&this.sceneryClear(backWorld,backX,.42)) drawables.push({d:d+16,draw:()=>tree(c,back.x,back.y,(80+hash(n)*20)*scale,n+31,true)});
          }
        }
      }
      if(p.sample.theme==='farmland') {
        drawables.push({d,draw:()=>this.fence(ps,d,cameraState,direction)});
      }
      if(n%13===0) {
        const sign=this.projectAt(ps,d,-1.35);
        if(sign)drawables.push({d,draw:()=>this.milepost(c,sign,n)});
      }
    }
    const limitMarkers=[1500,...state.counties.slice(1).map(q=>q.start+1000),75000,103000,275000,310000,BRANCH.end+1000];
    if(state.route==='detour')limitMarkers.push(BRANCH.decision+1000);
    for(const world of new Set(limitMarkers)) {
      const d=(world-origin)*direction;
      const signPs=state.route==='detour'&&world>=BRANCH.decision&&world<BRANCH.end?detour:ps;
      const p=this.projectAt(signPs,d,1.3);
      if(p&&p.y<=p.clip+3)drawables.push({d,draw:()=>roadSign(c,p.x,p.y,p.scale*2.4,String(getRoadSample(world,state.route).speedLimit),'','limit')});
    }
    for(const service of SERVICES) {
      const d=(service.distance-origin)*direction;
      const layout=getServiceLayout(service);
      const buildD=((vp.reverse?layout.buildingEnd:layout.buildingStart)-origin)*direction;
      if(buildD>-700&&buildD<DEPTH)drawables.push({d:Math.max(.7,buildD),draw:()=>this.serviceBuilding(cameraState,ps,service.id,vp.reverse,h)});
      const advance=this.projectAt(ps,d-900*direction,1.2*direction);
      if(advance && advance.y<=advance.clip+3)drawables.push({d:d-900*direction,draw:()=>this.serviceSign(advance.x,advance.y,advance.scale*3,service.kind,service.name,'PARKBUCHT →')});
    }
    // Historic county cues occur at fixed route positions, independent of render rate.
    for(const landmark of [33500,77400,169000,221000,287000,341000]) {
      const d=(landmark-origin)*direction;
      const p=this.projectAt(ps,d,-2.1);
      const footprint=landmark===77400?.94:landmark===221000?.32:.7;
      if(p && p.y<=p.clip+3&&this.sceneryClear(landmark,-2.1/1.125,footprint))drawables.push({d,draw:()=>{
        if(landmark===77400)building(c,p.x,p.y,p.scale*5,'covered');
        else if(landmark===221000)this.waterTower(c,p.x,p.y,p.scale*4);
        else roadSign(c,p.x,p.y,p.scale*3,landmark===287000?'ALLEGHENY RIDGE':'HISTORIC PENNSYLVANIA',landmark===341000?'OHIO 12 MILES':'SCENIC BYWAY');
      }});
    }
    for(const vehicle of (state.traffic || [])) {
      if((vehicle.distance-state.distance)*direction<=0)continue;
      if(!this.routeVisible(vehicle.distance,vehicle.route??'main',state.route))continue;
      const d=(vehicle.distance-origin)*direction;
      if(d<=0||d>DEPTH)continue;
      const lateral=vehicle.x*1.125*(vp.reverse?-1:1);
      const vehiclePs=vehicle.route==='detour'?detour:ps;
      const p=this.projectAt(vehiclePs,Math.max(vehiclePs[0].d,d),lateral);
      const width=p?p.scale*720*vehicleHalfWidth(vehicle.body):0;
      if(!p||!this.spriteVisible(p,width,h,vp.w))continue;
      drawables.push({d,draw:()=>{
        car(c,p.x,p.y,width,vehicle.color,vehicle.body,(vp.reverse?!vehicle.oncoming:vehicle.oncoming)?'front':'rear',0,vehicle.role==='police',Math.floor(state.drivingTime*4));
        if(vp.mirror)this.mirrorObjects++; else this.frameObjects++;
        if(vehicle.role==='rival' && width>14)pixelText(c,'RIVALE',p.x,p.y-width*.76,Math.max(5,Math.min(8,width*.16)),PAL.gold,'center');
      }});
    }
    // Rivals share a world position; draw them only if simulation has no matching traffic entity.
    for(const rival of state.rivals||[]) {
      if((state.traffic||[]).some(t=>t.id===rival.id))continue;
      if((rival.distance-state.distance)*direction<=0||!this.routeVisible(rival.distance,'main',state.route))continue;
      const d=(rival.distance-origin)*direction;
      if(d<=0||d>DEPTH)continue;
      const p=this.projectAt(ps,Math.max(ps[0].d,d),.75*1.125*(vp.reverse?-1:1));
      const width=p?p.scale*720*vehicleHalfWidth('sports'):0;
      if(!p||!this.spriteVisible(p,width,h,vp.w))continue;
      drawables.push({d,draw:()=>{
        car(c,p.x,p.y,width,rival.color,'sports',vp.reverse?'front':'rear');
        if(vp.mirror)this.mirrorObjects++; else this.frameObjects++;
      }});
    }
    const branchD=BRANCH.decision-origin;
    const signX=getRouteOffset(BRANCH.decision,'detour')+getRoadHalfWidth(BRANCH.decision,'detour')+.22;
    const bp=this.projectAt(ps,branchD,signX*1.125);
    if(bp && !vp.reverse)drawables.push({d:branchD,draw:()=>roadSign(c,bp.x,bp.y,bp.scale*3.2,'SCENIC ROUTE →','ALLEGHENY / MAINLINE ↑')});
    drawables.sort((a,b)=>b.d-a.d);
    for(const obj of drawables)obj.draw();
    if(getRoadSample(state.distance,state.route).theme==='tunnel')this.tunnel(c,h,origin,ps,vp.reverse);
    c.restore();
  }

  private worldQuad(state:RunState,ps:Projection[],reverse:boolean,start:number,end:number,left:number,right:number):number[]|null {
    const dir=reverse?-1:1;
    const z0=(start-state.distance)*dir,z1=(end-state.distance)*dir;
    const near=Math.max(ps[0].d,Math.min(z0,z1)),far=Math.min(ps[ps.length-1].d,Math.max(z0,z1));
    if(near>=far)return null;
    const a=this.projectAt(ps,near),b=this.projectAt(ps,far);if(!a||!b)return null;
    return [a.x+left*dir*a.scale*360,a.y,b.x+left*dir*b.scale*360,b.y,b.x+right*dir*b.scale*360,b.y,a.x+right*dir*a.scale*360,a.y];
  }
  private serviceGround(state:RunState,ps:Projection[],id:string,reverse:boolean):void {
    const stop=SERVICES.find(s=>s.id===id)!;const s=getServiceLayout(stop),c=this.ctx;
    const paint=(start:number,end:number,left:number,right:number,color:string)=>{
      for(let i=ps.length-2;i>=0;i--){
        const a=ps[i],b=ps[i+1];if(a.y<=b.y||b.y>b.clip+1)continue;
        const za=state.distance+(reverse?-a.d:a.d),zb=state.distance+(reverse?-b.d:b.d);
        const from=Math.max(start,Math.min(za,zb)),to=Math.min(end,Math.max(za,zb));if(from>=to)continue;
        const q=this.worldQuad(state,ps,reverse,from,to,left,right);if(q)poly(c,color,q);
      }
    };
    paint(s.start,s.end,.95,2.28,'#8e9180');
    paint(s.parkStart,s.parkEnd,s.parkLeft,s.parkRight,'#ead799');
    paint(s.parkStart+18,s.parkEnd-18,s.parkLeft+.025,s.parkRight-.025,'#707b70');
    const d=(stop.distance-state.distance)*(reverse?-1:1);
    const p=this.projectAt(ps,d,((s.parkLeft+s.parkRight)/2)*1.125*(reverse?-1:1));
    if(p&&p.y<=p.clip+3&&p.scale>.035&&state.route==='main') {
      pixelText(c,'STOP',p.x,p.y-2,Math.max(6,Math.min(26,p.scale*85)),'#f4df9f','center');
      this.serviceIcon(p.x,p.y-Math.max(10,p.scale*110),Math.max(.3,Math.min(1.2,p.scale*3)),stop.kind);
    }
  }
  private serviceBuilding(state:RunState,ps:Projection[],id:string,reverse:boolean,h:number):void {
    const stop=SERVICES.find(s=>s.id===id)!,s=getServiceLayout(stop),c=this.ctx;
    const q=this.worldQuad(state,ps,reverse,s.buildingStart,s.buildingEnd,s.buildingLeft,s.buildingRight);
    if(!q)return;
    const dir=reverse?-1:1;
    const near=Math.max(ps[0].d,Math.min((s.buildingStart-state.distance)*dir,(s.buildingEnd-state.distance)*dir));
    const far=Math.min(ps[ps.length-1].d,Math.max((s.buildingStart-state.distance)*dir,(s.buildingEnd-state.distance)*dir));
    const a=this.projectAt(ps,near)!,b=this.projectAt(ps,far)!;
    if(a.y>a.clip+5)return;
    const ah=a.scale*200*h/360,bh=b.scale*200*h/360;
    const roof=[q[0],q[1]-ah,q[2],q[3]-bh,q[4],q[5]-bh,q[6],q[7]-ah];
    poly(c,'#9c9b7f',[q[0],q[1],q[2],q[3],roof[2],roof[3],roof[0],roof[1]]);
    poly(c,'#d1c296',[q[0],q[1],q[6],q[7],roof[6],roof[7],roof[0],roof[1]]);
    poly(c,stop.kind==='diner'?'#a15e43':'#576e61',roof);
    const cx=(q[0]+q[6])/2,top=(roof[1]+roof[7])/2;
    if(a.scale>.035) {
      const width=Math.abs(q[6]-q[0]);rect(c,'#284c45',cx-width*.42,top+ah*.2,width*.84,ah*.36);
      const font=Math.max(5,Math.min(12,width/(stop.name.length*.7)));
      pixelText(c,stop.name.toUpperCase(),cx,top+ah*.45,font,'#f3d9a1','center');
      for(const n of [-1,1])rect(c,'#587f76',cx+n*width*.25-width*.09,top+ah*.64,width*.18,ah*.25);
    }
  }
  private serviceIcon(x:number,y:number,scale:number,kind:ServiceKind):void {
    const c=this.ctx;c.save();c.translate(x,y);c.scale(scale,scale);
    if(kind==='fuel') {rect(c,'#f0deb0',-7,-11,13,21);rect(c,'#375d54',-5,-8,9,6);rect(c,'#d8a366',-5,1,9,2);rect(c,'#f0deb0',-10,10,21,3);poly(c,'#f0deb0',[6,-8,11,-5,11,6,8,8,7,6,9,4,9,-3,6,-5]);}
    else if(kind==='garage') {poly(c,'#f0deb0',[-9,9,-5,12,8,-3,10,-9,6,-12,6,-6,2,-5,-2,-9,-8,-6,-6,0,0,1]);}
    else if(kind==='diner') {rect(c,'#f0deb0',-10,-4,16,13);rect(c,'#f0deb0',-12,10,26,2);rect(c,'#f0deb0',6,-3,7,3);rect(c,'#f0deb0',10,0,3,5);rect(c,'#f0deb0',6,5,7,3);rect(c,'#e4c38a',-6,-12,2,6);rect(c,'#e4c38a',0,-15,2,7);}
    else {rect(c,'#f0deb0',-14,-8,18,14);poly(c,'#f0deb0',[5,-4,12,-4,16,3,16,8,5,8]);rect(c,'#375d54',7,-2,5,5);rect(c,'#263e37',-10,6,5,5);rect(c,'#263e37',8,6,5,5);}
    c.restore();
  }
  private serviceSign(x:number,y:number,scale:number,kind:ServiceKind,name:string,sub:string):void {
    const c=this.ctx;c.save();c.translate(x,y);c.scale(scale,scale);
    rect(c,'#b7b79a',-2,-60,4,60);rect(c,'#eadbb4',-80,-102,160,45);rect(c,'#285a4f',-78,-100,156,41);
    this.serviceIcon(-58,-80,1,kind);pixelText(c,name.toUpperCase(),-36,-84,7,'#f2dbab');pixelText(c,sub,-36,-70,7,'#f2dbab');c.restore();
  }
  private roadLine(a: Projection,b: Projection,offset:number,width:number,color:string):void {
    poly(this.ctx,color,[a.x+a.half*(offset-width),a.y,b.x+b.half*(offset-width),b.y,b.x+b.half*(offset+width),b.y,a.x+a.half*(offset+width),a.y]);
  }
  private sceneryClear(distance:number,x:number,halfWidth:number):boolean {
    // A building has depth as well as a billboard anchor. Check the complete
    // plot against the turning road; otherwise a clear anchor can put its near
    // wall across a fork. The margin also bounds curvature within that plot.
    const depth=halfWidth>=.6?65:20,margin=.08+depth*depth*CURVE_SCALE/2/1.125;
    const overlap=(center:number,width:number)=>x+halfWidth>=center-width-margin&&x-halfWidth<=center+width+margin;
    for(let d=distance-depth;d<=distance+depth;d+=10){
      if(overlap(0,getRoadHalfWidth(d,'main')))return false;
      if(d>=BRANCH.start&&d<BRANCH.end&&overlap(getRouteOffset(d,'detour'),getRoadHalfWidth(d,'detour')))return false;
      if(SERVICES.some(stop=>{const l=getServiceLayout(stop);return d>=l.start&&d<=l.end&&x+halfWidth>=.94&&x-halfWidth<=3.6;}))return false;
    }
    return true;
  }
  private fence(ps:Projection[],d:number,state:RunState,direction:number):void {
    const c=this.ctx;
    for(const side of [-1,1]) {
      const world=state.distance+direction*d,absoluteX=side*1.7/1.125;
      if(!this.sceneryClear(world,absoluteX,.04)||!this.sceneryClear(world+direction*105,absoluteX,.04))continue;
      const a=this.projectAt(ps,Math.max(ps[0].d,d),side*1.7),b=this.projectAt(ps,d+105,side*1.7); if(!a||!b)continue;
      const height=a.scale*48,bh=b.scale*48;
      rect(c,'#b9b08b',a.x-2*a.scale,a.y-height,4*a.scale,height);
      for(const lift of [.38,.8])poly(c,'#b0a77d',[a.x,a.y-height*lift,b.x,b.y-bh*lift,b.x,b.y-bh*lift+Math.max(.5,b.scale*3),a.x,a.y-height*lift+Math.max(.5,a.scale*3)]);
    }
  }
  private milepost(c:Ctx,p:Projection,n:number):void {
    const k=p.scale*2;
    rect(c,'#d4cbb0',p.x-k*2,p.y-k*15,k*4,k*15);
    rect(c,'#456a55',p.x-k*3,p.y-k*30,k*6,k*17);
    if(k>.35)pixelText(c,String(Math.abs(n)%99),p.x,p.y-k*20,Math.max(4,k*5),'#e1d9ae','center');
  }
  private waterTower(c:Ctx,x:number,y:number,s:number):void {
    c.save();c.translate(x,y);c.scale(s,s);
    poly(c,'#686b5c',[-21,0,-10,-77,-7,-77,-16,0]);poly(c,'#686b5c',[16,0,7,-77,10,-77,21,0]);
    poly(c,'#828976',[-19,-10,15,-63,17,-61,-17,-8]);poly(c,'#828976',[19,-10,-15,-63,-17,-61,17,-8]);
    rect(c,'#bfba92',-26,-101,52,32);poly(c,'#677f71',[-28,-101,0,-118,28,-101]);rect(c,'#ded2a5',-23,-99,7,27);
    pixelText(c,'PENNA',0,-82,8,'#5b6554','center');c.restore();
  }
  private tunnel(c:Ctx,h:number,distance:number,ps:Projection[],reverse:boolean):void {
    const near=ps[0],far=ps[ps.length-1];
    const roof=(p:Projection)=>p.y-p.scale*450*h/360;
    const nl=near.x-near.half*1.12,nr=near.x+near.half*1.12;
    const fl=far.x-far.half*1.12,fr=far.x+far.half*1.12;
    poly(c,'#626f60',[0,0,fl,roof(far),nl,roof(near),nl,near.y,0,h]);
    poly(c,'#697260',[640,0,fr,roof(far),nr,roof(near),nr,near.y,640,h]);
    poly(c,'#344a43',[0,0,640,0,nr,roof(near),fr,roof(far),fl,roof(far),nl,roof(near)]);
    const phase=reverse?(95-distance%95)%95:distance%95;
    for(let d=DEPTH-phase;d>=35;d-=95) {
      const p=this.projectAt(ps,d);if(!p)continue;
      const left=p.x-p.half*1.12,right=p.x+p.half*1.12,top=roof(p);
      c.strokeStyle='#88927a';c.lineWidth=Math.max(.5,p.scale*4);c.beginPath();c.moveTo(left,p.y);c.lineTo(left,top);c.lineTo(right,top);c.lineTo(right,p.y);c.stroke();
      const size=Math.max(.7,p.scale*15);
      for(const side of [-1,1])rect(c,'#f1ce82',p.x+side*p.half*1.1,p.y-p.scale*170*h/360,size,p.scale*25*h/360);
    }
    const exitDistance=reverse?distance-147000:174000-distance;
    if(exitDistance>0&&exitDistance<DEPTH) {
      const p=this.projectAt(ps,Math.max(ps[0].d,exitDistance));
      if(p)rect(c,'#dccb94',p.x-p.half,p.y-p.scale*250*h/360,p.half*2,p.scale*250*h/360);
    }
  }

  private mirror(state:RunState,x:number,y:number,w:number,h:number,cockpit:boolean):void {
    const c=this.ctx;
    if(cockpit) {rect(c,'#182c2d',x+w/2-3,y-17,6,18);rect(c,'#b1b69e',x+w/2-1,y-15,2,12);}
    rect(c,'#13292c',x-5,y-5,w+10,h+10);rect(c,'#bec0a6',x-3,y-3,w+6,h+6);
    this.world(state,{x,y,w,h,reverse:true,mirror:true});
    rect(c,'#344c47',x,y+h-3,w,3);
    pixelText(c,cockpit?'':'RÜCKSPIEGEL',x+5,y+h-6,5,'#e5dfb9');
  }

  private topStrip(state:RunState):void {
    const c=this.ctx;
    rect(c,'#17393c',0,0,640,29);rect(c,'#d3a261',0,28,640,2);
    pixelText(c,'CANNONBALL',14,15,12,'#f2d4a0');pixelText(c,'COAST TO COAST / 70ER',14,24,7,'#98b9ae');
    const county=state.counties[state.countyIndex];
    pixelText(c,`PENNSYLVANIA · ${county?.name||'ALLEGHENY COUNTY'}`,320,12,8,'#f3e0b6','center');
    pixelText(c,`${(state.distance/1000).toFixed(1)} / ${STAGE_LENGTH/1000} KM`,320,23,7,'#a9c0ac','center');
    const remain=Math.max(0,1-state.distance/STAGE_LENGTH);
    rect(c,'#39554d',434,13,178,4);rect(c,'#deb674',434,13,178*(1-remain),4);
    pixelText(c,'START PA',434,24,5,'#93b7a7');pixelText(c,'OHIO →',612,24,5,'#e0c38f','right');
  }
  private commonHud(state:RunState,settings:ViewSettings):void {
    const c=this.ctx;this.topStrip(state);
    const current=getRoadSample(state.distance,state.route);
    rect(c,'#284840',13,37,90,14);pixelText(c,`LIMIT ${current.speedLimit} MPH`,19,47,7,'#e7d4a4');
    if(state.comment && state.drivingTime<state.comment.until) {
      const cockpit=settings.view==='cockpit';
      const priority=state.comment.priority>=2,limit=priority?69:78;
      const text=state.comment.text.length>limit?state.comment.text.slice(0,limit-3)+'…':state.comment.text;
      const line=`${state.comment.speaker.split(' ')[0]}: ${text}`;
      if(priority) {
        const xx=cockpit?220:102,yy=cockpit?230:338,width=cockpit?405:436;
        rect(c,'#223c39',xx,yy,width,17);rect(c,'#d5a265',xx,yy,3,17);
        pixelText(c,line,xx+9,yy+11,8,'#ecd8ad');
      } else {
        const xx=cockpit?22:112,yy=cockpit?240:347;
        pixelText(c,line,xx+1,yy+1,7,'#1d3934');pixelText(c,line,xx,yy,7,'#f0dfb7');
      }
    }
    pixelText(c,`${Math.floor(state.elapsed/60).toString().padStart(2,'0')}:${Math.floor(state.elapsed%60).toString().padStart(2,'0')}  /  VERSTÖSSE ${state.violations}/3`,622,356,7,'#ede0b7','right');
  }

  private arcadeHud(state:RunState,settings:ViewSettings):void {
    const c=this.ctx;
    rect(c,'#173a3c',13,238,129,92);rect(c,'#d2a66a',13,237,129,2);
    pixelText(c,`${Math.round(settings.units==='mph'?state.speed/1.609344:state.speed)}`,24,270,30,'#f2d5a0');
    pixelText(c,settings.units==='mph'?'MPH':'KM/H',103,268,8,'#94b8aa');
    this.bar(23,285,108,4,state.fuel/getVehicle(state.vehicleId).tank*100, `TANK ${Math.round(state.fuel)} L`,state.fuel<20?'#dc8256':'#d4b46c');
    this.bar(23,302,108,4,state.condition,`TECHNIK ${Math.round(state.condition)}%`,'#9cb788');
    this.bar(23,319,108,4,state.tires,`REIFEN ${Math.round(state.tires)}%`,state.tires<30?'#dc8256':'#9cb788');
    rect(c,'#173a3c',497,252,126,78);rect(c,'#d2a66a',497,251,126,2);
    pixelText(c,getVehicle(state.vehicleId).transmission==='manual'?'4-GANG · MANUELL':'3-GANG · AUTOMATIK',507,265,7,'#d4ba88');
    pixelText(c,String(state.gear||'N'),512,294,26,'#f3d6a0');
    pixelText(c,getVehicle(state.vehicleId).transmission==='manual'?'Q ↓  R ↑':'D · FAHREN',549,282,7,'#b1c9af');
    this.bar(548,292,62,4,state.rpm/70,'DREHZAHL',state.rpm>6000?'#dd7c53':'#a0ba8c');
    this.crewBars(state,505,316,111);
  }
  private bar(x:number,y:number,width:number,height:number,value:number,label:string,color:string):void {
    const c=this.ctx;
    pixelText(c,label,x,y-3,7,'#acc0a7');rect(c,'#40554b',x,y,width,height);
    rect(c,color,x,y,width*Math.max(0,Math.min(1,value/100)),height);
  }
  private crewBars(state:RunState,x:number,y:number,width:number):void {
    const c=this.ctx;
    state.crew.forEach((id,i)=> {
      const crew=CREW.find(person=>person.id===id);
      const xx=x+i*(width/2+3);
      pixelText(c,`${i===state.activeDriver?'▶':''}${crew?.name.split(' ')[0]||id} ${Math.round(state.fatigue[i])}%`,xx,y,7,i===state.activeDriver?'#f1d49c':'#a2bdac');
      rect(c,'#40554b',xx,y+3,width/2-4,3);rect(c,state.fatigue[i]>75?'#dc8457':'#9aaf80',xx,y+3,(width/2-4)*Math.min(1,state.fatigue[i]/100),3);
    });
  }

  private cockpit(state:RunState,settings:ViewSettings):void {
    const c=this.ctx,v=getVehicle(state.vehicleId),sports=v.body==='sports';
    // Slim A-pillars, broad glass, dashboard proportions modeled on 1970s instruments.
    poly(c,'#1f3333',[0,25,17,25,57,255,86,274,0,284]);
    poly(c,'#1f3333',[623,25,640,25,640,284,557,274,583,255]);
    poly(c,'#aa9d77',[0,35,7,35,43,252,58,263,51,264]);
    poly(c,'#aa9d77',[633,35,640,35,589,264,582,263,597,252]);
    poly(c,'#193133',[0,257,117,245,236,249,384,249,521,244,640,257,640,360,0,360]);
    poly(c,'#4c4b3b',[0,269,119,254,232,258,390,258,523,253,640,268,640,280,0,280]);
    poly(c,sports?'#313e37':'#79563e',[0,280,640,280,640,334,0,334]);
    rect(c,sports?'#64705a':'#bb9764',0,280,640,2);
    if(!sports)for(let y=284;y<331;y+=6)rect(c,'#815b3f',0,y,640,1);
    if(this.canvas.width>=960) {
      const unit=640/this.canvas.width;
      c.fillStyle=sports?'#485244':'#9a7651';
      for(let n=0;n<31;n++)c.fillRect(320+hash(n*19)*293,284+n*1.5,12+hash(n)*37,unit);
    }
    rect(c,'#172d2d',23,257,282,78);rect(c,'#34463e',27,261,274,71);
    this.gauge(84,308,50,settings.units==='mph'?state.speed/1.609344:state.speed,settings.units==='mph'?180:280,settings.units==='mph'?'MPH':'KM/H',true);
    this.gauge(191,308,50,state.rpm,8000,'RPM ×1000',false);
    this.gauge(269,306,22,state.fuel/v.tank*100,100,'FUEL',false,true);
    c.fillStyle=state.rpm>=5800?'#e4ad5c':'#4d5946';c.beginPath();c.arc(242,272,3,0,Math.PI*2);c.fill();
    // Chrome-rimmed clock and radio with amber scale and physical buttons.
    rect(c,'#233936',340,290,123,35);rect(c,'#a6a688',341,291,121,1);
    rect(c,'#1a302e',347,296,108,11);pixelText(c,'AM  60  80  100  140',401,304,6,'#d2bd85','center');
    rect(c,'#d6ab65',386,297,2,9);
    for(let i=0;i<5;i++)rect(c,'#92927a',369+i*13,312,10,6);
    for(const knob of [353,449]){c.fillStyle='#b5af8d';c.beginPath();c.arc(knob,315,5,0,Math.PI*2);c.fill();rect(c,'#34473e',knob-1,311,2,7);}
    rect(c,'#1e3431',484,293,128,23);
    for(let i=0;i<8;i++)rect(c,'#7b8168',491+i*14,296,2,16);
    if(this.canvas.width>=960) {
      const unit=640/this.canvas.width;
      c.fillStyle='#d1c6a1';
      for(let n=0;n<25;n++)c.fillRect(350+n*4,298,unit,n%5===0?5:2);
      c.fillStyle='#b2b294';
      for(let n=0;n<35;n++)c.fillRect(486+n*3.5,294,unit,18);
    }
    pixelText(c,sports?'STEINBACH 930':'HOHENFELS 450',549,330,8,'#dac595','center');
    this.steeringWheel(state.x,sports);
    rect(c,'#142d30',0,337,640,23);rect(c,'#7f815f',0,336,640,1);
    this.crewBars(state,306,348,196);
    pixelText(c,`TANK ${Math.round(state.fuel)} L · TECHNIK ${Math.round(state.condition)}% · REIFEN ${Math.round(state.tires)}%`,14,348,7,'#d3c394');
    pixelText(c,`${sports?'Q / R  ':'AUTO · '}GANG ${state.gear||'N'}`,521,348,7,'#e4c68b');
  }
  private gauge(x:number,y:number,r:number,value:number,max:number,label:string,speed:boolean,small=false):void {
    const c=this.ctx;
    c.fillStyle='#a7a78c';c.beginPath();c.arc(x,y,r+2,Math.PI,Math.PI*2);c.lineTo(x+r+2,y+12);c.lineTo(x-r-2,y+12);c.fill();
    c.fillStyle='#172e2d';c.beginPath();c.arc(x,y,r,Math.PI,Math.PI*2);c.lineTo(x+r,y+10);c.lineTo(x-r,y+10);c.fill();
    const ticks=small?4:speed?(max===180?9:7):8;
    if(!speed&&!small)for(const [start,end,color] of [[0,.45,'#6e8e6c'],[.45,.72,'#a8aa6b'],[.72,.9,'#c49b53'],[.9,1,'#b56c4e']] as const) {
      c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.arc(x,y,r-3,Math.PI+start*Math.PI,Math.PI+end*Math.PI);c.stroke();
    }
    for(let i=0;i<=ticks;i++) {
      const angle=Math.PI+i/ticks*Math.PI;
      const x1=x+Math.cos(angle)*(r-4),y1=y+Math.sin(angle)*(r-4);
      const x2=x+Math.cos(angle)*(r-8),y2=y+Math.sin(angle)*(r-8);
      c.strokeStyle=i/ticks>.8&&!speed?'#c07850':'#ddd1a6';c.lineWidth=1;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
      if(!small)pixelText(c,String(speed?Math.round(max*i/ticks):i),x+Math.cos(angle)*(r-14),y+Math.sin(angle)*(r-14)+2,7,'#d7d8b2','center');
    }
    const angle=Math.PI+Math.max(0,Math.min(1,value/max))*Math.PI;
    c.strokeStyle='#e39c64';c.lineWidth=2;c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(angle)*(r-9),y+Math.sin(angle)*(r-9));c.stroke();
    rect(c,'#b9b496',x-2,y-2,4,4);pixelText(c,label,x,y+10,small?6:7,'#c7c29c','center');
    if(!small)pixelText(c,speed?String(Math.round(value)).padStart(3,'0'):(value/1000).toFixed(1),x,y-11,11,'#e6d6a3','center');
  }
  private steeringWheel(steering:number,sports:boolean):void {
    const c=this.ctx;c.save();c.translate(153,392);c.rotate(Math.max(-.12,Math.min(.12,steering*.08)));
    c.lineWidth=9;c.strokeStyle='#132725';c.beginPath();c.ellipse(0,0,82,69,0,0,Math.PI*2);c.stroke();
    c.lineWidth=2;c.strokeStyle=sports?'#77816a':'#a28659';c.beginPath();c.ellipse(0,0,82,69,0,Math.PI,Math.PI*2);c.stroke();
    poly(c,'#1d3430',[-60,-6,-13,-10,-8,-2,-28,7,-60,5]);poly(c,'#1d3430',[60,-6,13,-10,8,-2,28,7,60,5]);
    poly(c,'#1d3430',[-8,0,8,0,14,46,-14,46]);rect(c,'#3b4d3f',-16,-12,32,24);rect(c,'#b4a779',-7,-5,14,9);
    c.restore();
  }

  private paperMap(state:RunState):void {
    const c=this.ctx;
    c.save();c.translate(435,100);
    poly(c,'#344a3d',[3,3,188,3,188,148,3,148]);
    poly(c,'#e7d5a3',[0,0,184,1,185,145,0,144]);
    rect(c,'#c9ba87',61,0,1,145);rect(c,'#c9ba87',123,0,1,145);
    pixelText(c,'PENNSYLVANIA',8,12,9,'#435d4b');pixelText(c,'ROAD ATLAS · 70ER',8,21,6,'#7e6b4b');
    pixelText(c,'NY → OH',177,21,6,'#7e6b4b','right');
    poly(c,'#b5bd99',[7,29,23,26,46,31,67,27,91,32,114,27,139,31,175,26,178,54,154,62,127,57,103,63,77,57,49,63,24,58,7,60]);
    c.strokeStyle='#7eaaa0';c.lineWidth=2;c.beginPath();c.moveTo(12,56);c.bezierCurveTo(40,18,66,65,101,35);c.bezierCurveTo(125,16,151,54,176,39);c.stroke();
    for(const county of state.counties){const p=mapRoutePoint(county.start);rect(c,'#a8ad87',p.x,29,1,30);}
    const path=(route:RouteChoice,start:number,end:number)=>{
      c.beginPath();for(let n=0;n<=80;n++){const p=mapRoutePoint(start+(end-start)*n/80,route);if(n)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);}c.stroke();
    };
    c.strokeStyle='#eee2ba';c.lineWidth=5;path('main',0,STAGE_LENGTH);
    c.strokeStyle='#a87849';c.lineWidth=2;path('main',0,STAGE_LENGTH);
    c.strokeStyle='#8e8056';c.lineWidth=1;c.setLineDash([2,2]);path('detour',BRANCH.decision,BRANCH.end);c.setLineDash([]);
    for(const stop of SERVICES){const p=mapRoutePoint(stop.distance);rect(c,'#3b6554',p.x-1,p.y-3,2,7);}
    for(const r of state.rivals||[]) {
      const p=mapRoutePoint(r.distance);rect(c,'#3b473d',p.x-3,p.y-8,7,5);rect(c,r.color,p.x-2,p.y-8,5,3);rect(c,'#3b473d',p.x-3,p.y-4,2,1);rect(c,'#3b473d',p.x+2,p.y-4,2,1);
    }
    const player=mapRoutePoint(state.distance,state.route);
    poly(c,'#923f32',[player.x,player.y-5,player.x+4,player.y+4,player.x-4,player.y+4]);
    SERVICES.forEach((stop,index)=>{
      const y=76+index*15,passed=stop.distance<state.distance-500;
      rect(c,passed?'#929d78':'#3e6653',7,y-9,18,12);
      this.serviceIcon(16,y-3,.4,stop.kind);
      pixelText(c,stop.name,30,y,7,passed?'#8c805a':'#405e49');
      pixelText(c,`${Math.round(stop.distance/1000)} km`,178,y,7,'#796b48','right');
    });
    pixelText(c,'▲ DU  ▰ RIVALEN  ■ SERVICE',8,143,6,'#7e6d4a');
    c.restore();
  }

  drawPreview(vehicleId='steinbach',phase=0):void {
    const c=this.ctx,v=getVehicle(vehicleId);
    c.setTransform(this.canvas.width/640,0,0,this.canvas.height/360,0,0);c.imageSmoothingEnabled=false;
    const sky=c.createLinearGradient(0,0,0,210);sky.addColorStop(0,'#487f89');sky.addColorStop(1,'#e4bd83');c.fillStyle=sky;c.fillRect(0,0,640,360);
    poly(c,'#698c79',[0,180,52,141,106,159,165,119,239,157,316,126,410,166,501,126,582,162,640,140,640,250,0,250]);
    poly(c,'#3f6a59',[0,202,86,167,137,188,220,159,289,188,356,153,450,186,530,161,640,190,640,260,0,260]);
    rect(c,'#a19a62',0,214,640,146);poly(c,'#5a6963',[271,214,367,214,640,360,0,360]);poly(c,'#ded1a4',[271,214,274,214,27,360,15,360]);poly(c,'#ded1a4',[364,214,367,214,625,360,613,360]);
    poly(c,'#dbb464',[318,216,321,216,326,360,314,360]);
    building(c,499,227,.8,'barn');tree(c,57,254,170,1);tree(c,601,241,122,4,true);tree(c,409,222,64,3,true);
    car(c,320,320,181,v.color,v.body,'rear',Math.sin(phase)*.2);
    roadSign(c,164,238,.8,'PENNSYLVANIA','THE KEYSTONE STATE');
    pixelText(c,'THE LONG WAY HOME.',320,66,20,'#f7dfaa','center');pixelText(c,'PENNSYLVANIA · 360 KM · 70ER-ÄRA',320,85,8,'#e7d8ac','center');
  }
}
