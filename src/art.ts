import type { BodyStyle } from './model.ts';

/** Original, code-drawn Pennsylvania roadside and period vehicle artwork. */
export const PAL = {
  ink: '#172c31', dark: '#253b3d', pine: '#24564e', teal: '#397469',
  sage: '#8d9b70', gold: '#efbd6d', cream: '#f8e8bf', rust: '#bd6747',
};
type Ctx = CanvasRenderingContext2D;
/** Road-lateral half widths, shared with collision geometry. */
export { vehicleHalfWidth } from './vehicle-shapes.ts';
export function poly(c: Ctx, color: string, points: number[]): void {
  c.fillStyle = color; c.beginPath(); c.moveTo(Math.round(points[0]), Math.round(points[1]));
  for (let i = 2; i < points.length; i += 2) c.lineTo(Math.round(points[i]), Math.round(points[i + 1]));
  c.closePath(); c.fill();
}
export function rect(c: Ctx, color: string, x: number, y: number, w: number, h: number): void {
  c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
export function pixelText(c: Ctx, text: string, x: number, y: number, size = 8, color = PAL.cream, align: CanvasTextAlign = 'left'): void {
  c.font = `bold ${size}px "Courier New", monospace`; c.textAlign = align;
  c.textBaseline = 'alphabetic'; c.fillStyle = color; c.fillText(text, Math.round(x), Math.round(y));
}
export function hash(n: number): number {
  const q = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return q - Math.floor(q);
}
export function tree(c: Ctx, x: number, y: number, h: number, seed: number, pine = false): void {
  if (h < 2) return;
  c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(h / 100, h / 100);
  rect(c, '#644e3c', -4, -60, 8, 60); rect(c, '#9b7751', 1, -49, 3, 48);
  if (pine) {
    poly(c, '#244d49', [-32,-13,-17,-35,-27,-35,-11,-56,-20,-55,0,-100,20,-55,11,-56,27,-35,17,-35,32,-13]);
    poly(c, '#3d6a55', [0,-100,2,-67,15,-57,3,-58,5,-37,21,-29,6,-31,10,-14,-4,-15,-9,-36,-5,-36,-8,-58,-3,-58]);
    poly(c, '#628466', [-14,-38,-8,-50,-1,-45,-4,-35]);
  } else {
    const autumn = hash(seed + 4) > .63;
    const dark = autumn ? '#8e673e' : '#3a5c42';
    const mid = autumn ? '#b48b45' : '#5d7a4b';
    const light = autumn ? '#d2aa58' : '#879451';
    poly(c, dark, [-28,-28,-39,-40,-43,-58,-34,-70,-24,-72,-21,-88,-4,-97,13,-91,25,-80,24,-69,38,-60,37,-41,24,-29,2,-23]);
    poly(c, mid, [-36,-60,-29,-73,-17,-73,-17,-88,-1,-94,13,-87,12,-76,25,-70,21,-54,6,-49,-10,-49,-20,-37,-30,-41]);
    poly(c, light, [-26,-74,-16,-75,-14,-87,-1,-91,9,-85,6,-76,-4,-73,-5,-61,-20,-58]);
    rect(c, mid, 19, -47, 10, 9); rect(c, light, -29,-59,7,6);
  }
  const density = Math.abs(c.getTransform().a);
  if (density > 1.1) {
    const unit=1/density;
    // At larger native rasters, individual leaf/pine highlights are one device pixel.
    for(let n=0;n<18;n++) {
      const xx=(hash(seed*17+n)-.5)*(pine?18:38);
      const yy=-38-hash(seed*19+n)*43;
      c.fillStyle=pine?'#70906e':'#c1b36c';c.fillRect(xx,yy,unit*2,unit);
    }
    c.fillStyle='#c19b68';c.fillRect(2,-36,unit,28);
  }
  c.restore();
}

export function building(c: Ctx, x: number, y: number, scale: number, kind: 'barn' | 'house' | 'diner' | 'fuel' | 'garage' | 'truckstop' | 'covered', name = ''): void {
  c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(scale, scale);
  if (kind === 'barn' || kind === 'covered') {
    const col = kind === 'covered' ? '#855443' : '#a95e43';
    rect(c, '#283e36', -66, -3, 134, 7);
    poly(c, col, [-58,0,-58,-51,-36,-78,36,-78,58,-51,58,0]);
    poly(c, '#574f45', [-65,-50,-39,-83,38,-83,66,-50,58,-46,34,-72,-33,-72,-58,-46]);
    rect(c, '#ce8c60', -55, -48, 109, 3);
    for (let bx = -49; bx <= 49; bx += 10) rect(c, '#93503d', bx, -44, 2, 44);
    rect(c, '#ead7a8', -23,-42,47,42); rect(c, '#5a4234', -19,-39,39,39);
    poly(c, '#dbc798', [-18,-37,-15,-38,18,-2,15,-1]); poly(c, '#dbc798', [17,-38,20,-36,-15,0,-18,-1]);
    rect(c, '#ead7a8', -8,-66,16,14); rect(c, '#334b48', -5,-63,10,8);
    if (kind === 'barn') { rect(c, '#a9a991', 64,-71,22,71); poly(c,'#6a7a72',[62,-71,66,-80,80,-80,88,-71]); rect(c,'#d3c9a6',66,-63,3,57); }
  } else if (kind === 'house') {
    rect(c, '#51634e', -55,-3,108,5); rect(c, '#c4b68c', -47,-52,91,52);
    poly(c, '#3e5550', [-55,-51,-5,-83,52,-51]); poly(c, '#65816b', [-53,-51,-5,-78,45,-51]);
    rect(c, '#90674a', 25,-79,9,22);
    for (let i = -44; i < 42; i += 6) rect(c, '#acaa87', i,-49,1,47);
    rect(c, '#595348', -7,-29,17,29); rect(c, '#e8d6aa', -9,-31,21,3);
    for (const wx of [-35,24]) { rect(c, '#e8d6aa', wx-2,-37,17,19); rect(c, '#3f6b6d', wx,-35,13,15); rect(c, '#e8d6aa', wx+6,-35,2,15); rect(c, '#e8d6aa', wx,-28,13,2); }
    rect(c, '#dfd0a7', -51,-12,104,4); rect(c, '#dfd0a7', -48,-8,3,10); rect(c, '#dfd0a7', 48,-8,3,10);
  } else {
    const isFuel = kind === 'fuel' || kind === 'truckstop';
    rect(c, '#5e6655', -81,-2,165,7); rect(c, '#dfcc9b', -69,-43,134,43);
    rect(c, '#8b4d3e', -74,-49,145,9); rect(c, '#e2ae68', -71,-47,139,3);
    if (kind === 'garage') {
      rect(c, '#77867b', -51,-32,50,32); for(let j=-29;j<0;j+=7) rect(c,'#a0a795',-49,j,46,2);
      rect(c, '#3c615c', 21,-29,22,29);
    } else {
      for(let wx=-58;wx<50;wx+=30) { rect(c, '#765b45', wx-2,-32,25,23); rect(c, '#527d75', wx,-30,21,18); rect(c,'#adc4a4',wx,-30,19,2); }
      rect(c, '#664f3b', 44,-31,15,31);
    }
    rect(c, '#253f3e', -54,-62,104,15); pixelText(c, name || (isFuel ? 'KEYSTONE GAS' : kind === 'garage' ? 'AUTO SERVICE' : 'BLUE PLATE DINER'), -2,-51,7,'#f2d59d','center');
    if (isFuel) {
      for(const px of [-39,18]) { rect(c,'#843e34',px,-22,13,22); rect(c,'#ead9af',px,-32,13,17); rect(c,'#354b48',px+2,-29,9,7); rect(c,'#e5d9b4',px-2,-1,17,3); rect(c,'#273d38',px+14,-23,2,17); rect(c,'#273d38',px+15,-8,4,2); }
    } else { rect(c,'#e8c08b',-61,-6,94,4); rect(c,'#805342',-59,-2,3,5); rect(c,'#805342',28,-2,3,5); }
  }
  c.restore();
}

export function roadSign(c: Ctx, x: number, y: number, scale: number, label: string, sub = '', type: 'green' | 'limit' | 'warning' = 'green'): void {
  c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(scale,scale);
  rect(c,'#a2aa91',-2,-55,4,55);
  if (type === 'limit') {
    rect(c,'#213b38',-16,-95,33,42); rect(c,'#e5debc',-14,-93,29,38);
    pixelText(c,'SPEED',0,-83,6,'#273735','center'); pixelText(c,'LIMIT',0,-76,6,'#273735','center'); pixelText(c,label,0,-59,16,'#273735','center');
  } else if (type === 'warning') {
    poly(c,'#4b533d',[-26,-76,0,-102,26,-76,0,-50]); poly(c,'#eac16b',[-23,-76,0,-99,23,-76,0,-53]); pixelText(c,label,0,-73,9,'#51492f','center');
  } else {
    const width = Math.max(64, label.length * 5 + 16);
    rect(c,'#d9d7b4',-width/2-2,-88,width+4,34); rect(c,'#335f51',-width/2,-86,width,30);
    pixelText(c,label,0,-74,8,'#f2e5b9','center'); pixelText(c,sub,0,-63,6,'#d3dab0','center');
  }
  c.restore();
}

export function car(c: Ctx, x: number, y: number, w: number, color: string, body: BodyStyle | 'truck' = 'sedan', facing: 'rear' | 'front' = 'rear', steering = 0, police = false, flash = 0): void {
  if (w < 2) return;
  c.save(); c.translate(Math.round(x),Math.round(y)); c.scale(w/100,w/100);
  const sports=body==='sports', tall=body==='van'||body==='rv'||body==='truck';
  const top = tall ? -86 : sports ? -49 : -59;
  const roof = tall ? -76 : sports ? -44 : -53;
  poly(c, '#263d36', [-56,-3,-45,-12,45,-12,58,-3,48,3,-46,3]);
  if(body==='truck') {
    rect(c,'#1c2d2b',-47,-23,16,23);rect(c,'#1c2d2b',31,-23,16,23);
    if(facing==='rear') {
      rect(c,'#293f39',-49,-98,98,87);rect(c,'#bbb79a',-46,-95,92,79);
      rect(c,'#d6cfac',-44,-94,89,3);rect(c,'#6d8070',-1,-90,2,70);
      for(let row=-86;row<-23;row+=8)rect(c,'#9da88e',-43,row,86,1);
      for(const hx of [-8,8]){rect(c,'#5b6d60',hx,-71,2,42);rect(c,'#e4d7ae',hx-1,-47,4,3);}
      rect(c,'#344d43',-49,-19,98,8);rect(c,'#c4b895',-51,-12,102,5);
      for(const xx of [-43,-32,28,39])rect(c,'#d67950',xx,-17,6,4);
      rect(c,'#1d332e',-40,-7,80,5);rect(c,'#e8d9af',-10,-11,20,5);
    } else {
      rect(c,'#60786b',-43,-110,86,70);rect(c,'#b5b696',-40,-107,80,4);
      rect(c,'#334f45',-39,-90,2,54);rect(c,'#334f45',37,-90,2,54);
      rect(c,'#d1c4a0',-48,-89,4,60);rect(c,'#d1c4a0',44,-89,4,60);
      poly(c,color,[-35,-75,-29,-83,29,-83,35,-75,37,-34,-37,-34]);
      rect(c,'#c8b88e',-29,-79,58,3);rect(c,'#25484a',-29,-70,26,20);rect(c,'#25484a',3,-70,26,20);
      rect(c,'#9fb5a1',-27,-69,21,3);rect(c,'#9fb5a1',5,-69,21,3);
      poly(c,color,[-29,-48,29,-48,39,-32,40,-12,-40,-12,-39,-32]);
      poly(c,'#b99b6f',[-29,-48,29,-48,33,-42,-33,-42]);
      rect(c,'#c9c7a4',-21,-33,42,26);rect(c,'#3a5148',-18,-30,36,21);
      for(let xx=-15;xx<=15;xx+=5)rect(c,'#bfc3a1',xx,-29,2,19);
      rect(c,'#dfd9ad',-43,-25,17,9);rect(c,'#dfd9ad',26,-25,17,9);
      rect(c,'#a8b296',-52,-10,104,6);rect(c,'#e2d7ae',-48,-10,96,1);
      for(const xx of [-23,-11,0,11,23])rect(c,'#dbb165',xx,-85,4,3);
    }
    c.restore();return;
  }
  rect(c,'#1f2928',-46,-22,14,22); rect(c,'#1f2928',32,-22,14,22);
  rect(c,'#535449',-44,-17,3,12); rect(c,'#535449',41,-17,3,12);
  const nose=steering*3;
  poly(c,'#1f3331',[-49,-9,-51,-28,-45,-37,-35,top-2,35,top-2,46,-37,51,-28,49,-9]);
  poly(c,color,[-48,-12,-49,-29,-42,-34,-33,top,33,top,43,-34,49,-29,48,-12]);
  poly(c,'#f2d69c',[-32,top,31,top,34,top+3,-34,top+3]);
  if(tall) {
    rect(c,color,-39,roof,78,42); rect(c,'#163c42',-32,roof+6,28,22); rect(c,'#163c42',4,roof+6,28,22);
    rect(c,'#87a9a0',-30,roof+7,24,3); rect(c,'#87a9a0',6,roof+7,24,3);
    rect(c,'#b9bca1',-1,roof+3,2,47);
    if(body==='rv') { rect(c,'#d9cfaa',-41,roof+32,82,10); rect(c,'#a9764a',-41,roof+43,82,7); }
  } else {
    poly(c,'#233f43',[-32+nose,roof+5,31+nose,roof+5,39,-29,-38,-29]);
    poly(c,'#779792',[-29+nose,roof+7,28+nose,roof+7,32,-34,-33,-34]);
    poly(c,'#afc0a2',[-27+nose,roof+7,-11+nose,roof+7,-25,-34,-32,-34]);
    rect(c,'#2b4140',-36,-30,73,3);
    if (sports && facing === 'rear') { rect(c,'#203b37',-48,-29,96,5); rect(c,'#c29a68',-45,-29,90,2); }
  }
  poly(c,'#f4d6a0',[-46,-29,-39,-30,-35,-26,35,-26,40,-30,46,-29,45,-25,-45,-25]);
  if(facing==='rear') {
    rect(c,'#7d3530',-43,-23,24,8); rect(c,'#df7350',-41,-22,12,5); rect(c,'#e7b66b',-27,-22,6,5);
    rect(c,'#7d3530',19,-23,24,8); rect(c,'#df7350',29,-22,12,5); rect(c,'#e7b66b',21,-22,6,5);
    rect(c,'#203a37',-17,-21,34,5); for(let i=-13;i<15;i+=4) rect(c,'#5d7262',i,-21,2,4);
    pixelText(c,sports?'STEINBACH':tall?'PENNA':'HOHENFELS',0,-12,4,'#f4deac','center');
  } else {
    rect(c,'#243d3b',-44,-24,88,12); rect(c,'#bbbfa1',-21,-23,43,9);
    for(let i=-18;i<20;i+=5) rect(c,'#3e5750',i,-22,2,7);
    if(sports) { for(const hx of [-35,35]) { c.fillStyle='#eadfb6'; c.beginPath(); c.arc(hx,-23,7,0,Math.PI*2); c.fill(); rect(c,'#f7e8bc',hx-3,-26,4,4); } }
    else { rect(c,'#eee1b5',-42,-22,18,7); rect(c,'#eee1b5',24,-22,18,7); rect(c,'#fff0ca',-40,-21,5,4); rect(c,'#fff0ca',26,-21,5,4); }
  }
  rect(c,'#c0bca0',-47,-10,94,4); rect(c,'#ede0b4',-45,-10,89,1);
  rect(c,'#293d37',-37,-10,5,5); rect(c,'#293d37',32,-10,5,5);
  rect(c,'#e9dbb5',-10,-9,20,6); rect(c,'#527066',-8,-7,15,2);
  rect(c,'#273b37',-44,-3,10,3); rect(c,'#273b37',34,-3,10,3);
  const density=Math.abs(c.getTransform().a);
  if(density>1.1) {
    const unit=1/density;
    // Fine glass streaks, individual grille slats and chrome pinstripes only at native HD.
    c.fillStyle='#c8d0b0';c.fillRect(-28,roof+7,unit,Math.max(2,-roof-39));
    c.fillStyle='#6d8c82';c.fillRect(-20,roof+8,unit,Math.max(2,-roof-39));
    c.fillStyle='#e2d2a9';c.fillRect(-42,-10,84,unit);
    c.fillStyle='#d49b61';c.fillRect(-46,-24,unit,10);c.fillRect(46-unit,-24,unit,10);
    if(facing==='rear')for(let gx=-14;gx<=14;gx+=2) {c.fillStyle='#b4a986';c.fillRect(gx,-21,unit,3);}
    if(!tall)for(let gx=-32;gx<32;gx+=4) {c.fillStyle='#405952';c.fillRect(gx,-29,unit,2);}
  }
  if(police) {
    rect(c,'#263c3a',-25,top-8,50,6);
    rect(c,flash%2===0?'#ff785b':'#733f38',-22,top-13,17,7);
    rect(c,flash%2===1?'#9de1e5':'#3b6070',5,top-13,17,7);
  }
  c.restore();
}
