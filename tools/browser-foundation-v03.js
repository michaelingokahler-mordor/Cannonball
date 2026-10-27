async(page)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:960});
 await page.goto('http://127.0.0.1:5173/');
 await page.evaluate(async()=>{
  localStorage.setItem('cannonball.pa.save.v1',await(await fetch('/output/qa/service-save.json')).text());
  localStorage.setItem('cannonball.pa.settings.v1',JSON.stringify({view:'arcade',resolution:'1280x720',map:true,units:'mph',sound:false,speech:false}));
 });
 const originalSave=await page.evaluate(()=>localStorage.getItem('cannonball.pa.save.v1'));
 async function launch(id){
  await page.goto('http://127.0.0.1:5173/');await page.locator('.test-launcher summary').click();
  await page.locator(`[data-test-scenario="${id}"]`).click();
  await page.waitForFunction(id=>window.__cannonball.getTestScenario()===id,id);
  if(!(await page.locator('.test-scenario-banner').innerText()).includes('TESTFAHRT'))throw Error('Test banner missing');
 }
 async function drive(mode){
  await page.evaluate(async(mode)=>{
   const {driveTraffic}=await import('/tests/helpers/driver.ts');
   const {getVehicle,BRANCH,TIME_SCALE}=await import('/src/data.ts');
   const {trafficSoundLevels}=await import('/src/police-presentation.ts');
   const keys=new Set(),driver={};let detected=false,firstStop=false,officerId=null;
   const start=window.__cannonball.getState().drivingTime;
   const set=(code,on)=>{if(keys.has(code)===on)return;window.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{code,bubbles:true}));on?keys.add(code):keys.delete(code);};
   const pulse=code=>{window.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));};
   window.__qaRun={mode,done:false,samples:[],firstStop:false};
   const timer=setInterval(()=>{
    const s=window.__cannonball.getState(),time=s.drivingTime-start;
    const officer=s.traffic.find(c=>c.role==='police');officerId??=officer?.id;
    if(officer&&officer.id!==officerId){window.__qaRun.error='Officer identity changed';}
    const sound=trafficSoundLevels(s);detected ||= s.police.mode==='pursuit';
    const finish=mode==='police'?s.violations===1:mode==='fork'?s.route==='detour'&&s.distance>BRANCH.decision+1400:mode==='service'?s.status==='service':time>=25;
    if(Math.floor(time*2)>window.__qaRun.samples.length-1)window.__qaRun.samples.push({t:time,d:s.distance,x:s.x,v:s.speed,police:s.police.mode,gap:officer?s.distance-officer.distance:null,siren:sound.siren,violations:s.violations});
    if(detected&&s.speed===0&&!firstStop){firstStop=true;window.__qaRun.firstStop=true;}
    Object.assign(window.__qaRun,{status:s.status,route:s.route,distance:s.distance,x:s.x,speed:s.speed,violations:s.violations,police:s.police.mode,officerId,gap:officer?s.distance-officer.distance:null,siren:sound.siren,condition:s.condition,drivingSeconds:time,render:window.__cannonball.getRenderStats(),serviceId:s.serviceId});
    if(finish||s.status==='failed'||time>65){for(const key of [...keys])set(key,false);window.__qaRun.done=true;clearInterval(timer);return;}
    Object.assign(driver,s);const car=getVehicle(s.vehicleId);
    if(s.gear<car.gears&&s.speed>car.gearSpeeds[s.gear-1]*.92)pulse('KeyR');
    let target=mode==='police'?160:70;
    if(mode==='traffic')target=time<8||time>17?0:70;
    if(mode==='service')target=Math.min(70,Math.sqrt(2*40*3.6*Math.max(0,44820-s.distance)/TIME_SCALE));
    let input=driveTraffic(driver,target);
    if(mode==='police'&&detected)input={throttle:0,brake:1,steer:s.x<1.72?1:s.x>1.78?-1:0};
    if(mode==='service'&&s.distance>42700)input.steer=s.x<1.72?1:s.x>1.78?-1:0;
    if(mode==='fork'){
     const x=s.route==='detour'?.22:s.distance>=BRANCH.start+50?1.3:.75;
     // This scenario deliberately fixes the route-selection lane. Do not use a
     // test driver's remembered alternative passing lane to brake on this one.
     let limit=70;
     for(const actor of s.traffic){
      if(actor.oncoming||actor.distance<=s.distance||Math.abs(actor.x-s.x)>.35)continue;
      limit=Math.min(limit,Math.sqrt(actor.speed**2+2*41*3.6*Math.max(0,actor.distance-s.distance-30)/TIME_SCALE));
     }
     input.throttle=s.speed<limit-.2?1:0;input.brake=s.speed>limit+.2?1:0;
     input.steer=s.x<x-.025?1:s.x>x+.025?-1:0;
    }
    set('ArrowUp',input.throttle>0);set('ArrowDown',input.brake>0);set('ArrowRight',input.steer>.25);set('ArrowLeft',input.steer<-.25);
   },16);
  },mode);
  await page.waitForFunction(()=>window.__qaRun?.done,null,{timeout:90000});
  const result=await page.evaluate(()=>window.__qaRun);
  if(result.error||result.status==='failed')throw Error(JSON.stringify({...result,samples:undefined}));
  await page.locator('canvas').screenshot({path:`output/playwright/v03-input-${mode}.png`});
  return result;
 }
 const results=[];
 await launch('police');await page.locator('canvas').screenshot({path:'output/playwright/v03-input-police-before.png'});
 const police=await drive('police');if(police.violations!==1||police.siren!==0||police.gap<45||police.gap>110)throw Error(JSON.stringify({...police,samples:undefined}));results.push(police);
 await launch('fork');const fork=await drive('fork');if(fork.route!=='detour'||fork.drivingSeconds>40)throw Error(JSON.stringify({...fork,samples:undefined}));results.push(fork);
 await launch('service');const service=await drive('service');if(service.serviceId!=='sundown')throw Error(JSON.stringify({...service,samples:undefined}));
 if(!(await page.getByRole('button',{name:'Sicher speichern',exact:true}).isDisabled()))throw Error('Test save was enabled');results.push(service);
 await launch('traffic');results.push(await drive('traffic'));
 await launch('curves');await page.keyboard.press('p');await page.locator('canvas').screenshot({path:'output/playwright/v03-input-curve-start.png'});
 if(await page.evaluate(()=>localStorage.getItem('cannonball.pa.save.v1'))!==originalSave)throw Error('Test drives overwrote normal save');
 if(errors.length)throw Error(errors.join(';'));
 return {passed:['five-visible-launchers','persistent-test-label','actual-input-police-stop','actual-input-fork','automatic-service','test-save-protection','standing-and-braking-traffic'],results,pageErrors:errors};
}
