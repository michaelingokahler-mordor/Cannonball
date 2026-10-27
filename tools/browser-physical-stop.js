async (page) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.evaluate(()=>{localStorage.removeItem('cannonball.pa.save.v1');localStorage.removeItem('cannonball.pa.settings.v1');});
  await page.reload();await page.getByRole('button',{name:'Motor starten →'}).click();
  await page.waitForFunction(()=>window.__cannonball.getState()?.status==='driving');
  await page.evaluate(async()=>{
    const {driveTraffic}=await import('/tests/helpers/driver.ts');
    const {getVehicle,TIME_SCALE}=await import('/src/data.ts');
    const {getRoadSample}=await import('/src/road.ts');
    const keys=new Set();const driverState={};window.__qaStop={status:'driving',frames:0,pressedE:false};
    const set=(code,on)=>{if(on===keys.has(code))return;window.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{code,bubbles:true}));on?keys.add(code):keys.delete(code);};
    const timer=setInterval(()=>{
      const state=window.__cannonball.getState();if(!state)return;
      Object.assign(window.__qaStop,{status:state.status,distance:state.distance,x:state.x,speed:state.speed,drivingTime:state.drivingTime,condition:state.condition,violations:state.violations,serviceId:state.serviceId,log:state.log.slice(-6)});
      if(state.status!=='driving'){for(const key of [...keys])set(key,false);clearInterval(timer);return;}
      Object.assign(driverState,state);
      const car=getVehicle(state.vehicleId);
      if(state.gear<car.gears&&state.speed>=car.gearSpeeds[state.gear-1]*.94){window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyR',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyR',bubbles:true}));}
      const checkpoint=state.counties.find(c=>c.police&&!c.police.activated&&!c.police.resolved&&c.police.trigger>=state.distance)?.police;
      const posted=checkpoint?getRoadSample(checkpoint.trigger).speedLimit*1.609344:255;
      const slowing=Math.max(0,state.speed**2-posted**2)*TIME_SCALE/(2*40*3.6)+550;
      let target=checkpoint&&checkpoint.trigger-state.distance<slowing?posted:255;
      const approach=45000-state.distance<6500;
      if(approach)target=Math.min(target,Math.sqrt(2*40*3.6*Math.max(0,44900-state.distance-80)/TIME_SCALE));
      const input=driveTraffic(driverState,target);
      if(approach&&state.distance>=42650)input.steer=state.x<1.72?1:state.x>1.78?-1:0;
      set('ArrowUp',input.throttle>0);set('ArrowDown',input.brake>0);
      set('ArrowRight',input.steer>.25);set('ArrowLeft',input.steer<-.25);
      window.__qaStop.frames++;
    },16);
  });
  try{await page.waitForFunction(()=>window.__qaStop?.status!=='driving',{},{timeout:180000});}
  catch(error){throw new Error(`${error.message}; ${JSON.stringify(await page.evaluate(()=>window.__qaStop))}`);}
  const result=await page.evaluate(()=>window.__qaStop);
  await page.screenshot({path:'output/playwright/v02-physical-service.png',fullPage:true});
  if(result.status!=='service'||result.serviceId!=='sundown'||result.pressedE)throw new Error(JSON.stringify(result));
  if(errors.length)throw new Error(errors.join(';'));
  return {passed:['actual-input-driving','physical-apron','automatic-service-without-E'],...result,pageErrors:errors};
}
