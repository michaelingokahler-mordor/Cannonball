async (page) => {
  await page.setViewportSize({width:1440,height:960});
  await page.goto('http://127.0.0.1:5173/');
  await page.evaluate(async()=>{
    const simulation=await import('/src/simulation.ts');
    const {GameRenderer}=await import('/src/render.ts');
    const canvas=document.createElement('canvas');canvas.id='qa-police-traffic';
    Object.assign(canvas.style,{position:'fixed',left:'0',top:'0',zIndex:'99999',imageRendering:'pixelated'});
    document.body.append(canvas);
    window.__qaPoliceTraffic={canvas,renderer:new GameRenderer(canvas),simulation,
      settings:{view:'cockpit',resolution:'640x360',map:false,units:'kmh',sound:false,speech:false}};
  });
  const frames=[];
  for(const resolution of ['640x360','1280x720']){
    const suffix=resolution==='640x360'?'640':'1280';
    const early=await page.evaluate(resolution=>{
      const q=window.__qaPoliceTraffic;q.settings.resolution=resolution;
      const [width,height]=resolution.split('x');q.canvas.style.width=`${width}px`;q.canvas.style.height=`${height}px`;
      q.state=q.simulation.createRun({seed:42});const event=q.state.counties[0].police;
      Object.assign(q.state,{distance:event.trigger-600,x:.75,speed:220,gear:4});
      q.simulation.updateRun(q.state,{throttle:1,brake:0,steer:0},1/60);
      if(q.state.police.mode!=='watching'||event.activated)throw new Error('Fast approach must show parked police before the detection threshold');
      const before=JSON.stringify(q.state),stats=q.renderer.render(q.state,q.settings);
      if(JSON.stringify(q.state)!==before)throw new Error('Renderer mutated early approach state');
      return {scene:'police-watching-early',resolution,mode:q.state.police.mode,distanceBeforeTrigger:event.trigger-q.state.distance,eventActivated:event.activated,...stats};
    },resolution);
    await page.locator('#qa-police-traffic').screenshot({path:`output/playwright/v02-police-watching-early-${suffix}.png`});frames.push(early);
    const watching=await page.evaluate(resolution=>{
      const q=window.__qaPoliceTraffic;
      q.settings.resolution=resolution;
      const [width,height]=resolution.split('x');q.canvas.style.width=`${width}px`;q.canvas.style.height=`${height}px`;
      q.state=q.simulation.createRun({seed:42});
      const event=q.state.counties[0].police;
      Object.assign(q.state,{distance:event.trigger-140,x:.75,speed:80,gear:3});
      q.simulation.updateRun(q.state,{throttle:0,brake:0,steer:0},1/60);
      const officer=q.state.traffic.find(car=>car.role==='police');
      if(q.state.police.mode!=='watching'||event.activated||!officer||officer.speed!==0)throw new Error('Officer must be visibly parked before pursuit');
      q.officerId=officer.id;const before=JSON.stringify(q.state),stats=q.renderer.render(q.state,q.settings);
      if(JSON.stringify(q.state)!==before)throw new Error('Renderer mutated watching state');
      return {scene:'police-watching',resolution,mode:q.state.police.mode,officerId:officer.id,officerSpeed:officer.speed,
        distanceBeforeTrigger:event.trigger-q.state.distance,eventActivated:event.activated,...stats};
    },resolution);
    await page.locator('#qa-police-traffic').screenshot({path:`output/playwright/v02-police-watching-${suffix}.png`});frames.push(watching);
    const pursuit=await page.evaluate(()=>{
      const q=window.__qaPoliceTraffic;
      Object.assign(q.state,{speed:220,gear:4});
      for(let tick=0;tick<180;tick++){
        q.simulation.updateRun(q.state,{throttle:1,brake:0,steer:0},1/60);
        if(q.state.police.mode==='pursuit'&&q.state.police.gap>65)break;
      }
      const officer=q.state.traffic.find(car=>car.role==='police');
      if(q.state.police.mode!=='pursuit'||officer?.id!==q.officerId||q.state.police.gap<=0)throw new Error('Same officer must pursue from behind');
      const before=JSON.stringify(q.state),stats=q.renderer.render(q.state,q.settings);
      if(JSON.stringify(q.state)!==before)throw new Error('Renderer mutated pursuit state');
      if(stats.mirrorObjects<1)throw new Error('Real mirror must contain the pursuing officer');
      return {scene:'police-pursuit-mirror',resolution:q.settings.resolution,mode:q.state.police.mode,officerId:officer.id,
        gap:q.state.police.gap,pursuitTime:q.state.police.pursuitTime,officerSpeed:officer.speed,...stats};
    });
    await page.locator('#qa-police-traffic').screenshot({path:`output/playwright/v02-police-pursuit-mirror-${suffix}.png`});frames.push(pursuit);
    const traffic=await page.evaluate(()=>{
      const q=window.__qaPoliceTraffic;q.state=q.simulation.createRun({seed:42});
      Object.assign(q.state,{distance:20000,x:.75,speed:80,gear:3,comment:null});
      const truck=q.state.traffic.find(car=>car.body==='truck'&&!car.oncoming);
      const ordinary=q.state.traffic.find(car=>car.body==='sedan'&&car.role==='traffic'&&!car.oncoming);
      Object.assign(truck,{distance:q.state.distance+150,x:.75,targetX:.75});
      Object.assign(ordinary,{distance:q.state.distance+100,x:.25,targetX:.25});
      q.simulation.updateRun(q.state,{throttle:0,brake:0,steer:0},1/60);
      const before=JSON.stringify(q.state),stats=q.renderer.render(q.state,q.settings);
      if(JSON.stringify(q.state)!==before)throw new Error('Renderer mutated traffic state');
      if(stats.objects<2)throw new Error('Truck and ordinary car must render together');
      return {scene:'truck-and-car',resolution:q.settings.resolution,truckId:truck.id,truckBody:truck.body,ordinaryId:ordinary.id,
        ordinaryBody:ordinary.body,truckGap:truck.distance-q.state.distance,ordinaryGap:ordinary.distance-q.state.distance,...stats};
    });
    await page.locator('#qa-police-traffic').screenshot({path:`output/playwright/v02-truck-and-car-${suffix}.png`});frames.push(traffic);
  }
  await page.evaluate(()=>{window.__qaPoliceTraffic.canvas.remove();delete window.__qaPoliceTraffic;});
  return {passed:['parked-watching-before-trigger','same-police-entity-pursues','real-rear-mirror-entity','truck-and-car-visible','renderer-is-read-only'],frames};
}
