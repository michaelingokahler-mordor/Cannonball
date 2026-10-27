async (page) => {
  await page.setViewportSize({width:1440,height:960});
  await page.goto('http://127.0.0.1:5173/');
  await page.evaluate(async()=>{
    const {GameRenderer}=await import('/src/render.ts');const {createRun}=await import('/src/simulation.ts');
    const canvas=document.createElement('canvas');canvas.id='qa-scene';
    Object.assign(canvas.style,{position:'fixed',left:'0',top:'0',zIndex:'99999',width:'1280px',height:'720px',imageRendering:'pixelated'});
    document.body.append(canvas);
    window.__qaScene={canvas,renderer:new GameRenderer(canvas),state:createRun({seed:42}),settings:{view:'arcade',resolution:'1280x720',map:true,units:'mph',sound:false,speech:false}};
  });
  const frames=[];
  for(const scene of [
    {name:'service-approach',distance:44700,x:.75,route:'main',view:'arcade'},
    {name:'service-bay',distance:45000,x:1.75,route:'main',view:'arcade'},
    {name:'fork-approach',distance:101900,x:1.25,route:'main',view:'arcade'},
    {name:'detour',distance:104000,x:.25,route:'detour',view:'arcade'},
    {name:'cockpit-640',distance:44700,x:.75,route:'main',view:'cockpit',resolution:'640x360'},
    {name:'cockpit-720',distance:44700,x:.75,route:'main',view:'cockpit',resolution:'1280x720'},
  ]){
    const result=await page.evaluate(scene=>{
      const q=window.__qaScene;Object.assign(q.state,{distance:scene.distance,x:scene.x,route:scene.route,routeChoice:scene.route,speed:0,comment:null});
      q.state.traffic=[];q.settings.view=scene.view;q.settings.resolution=scene.resolution??'1280x720';
      const before=JSON.stringify(q.state);const stats=q.renderer.render(q.state,q.settings);
      if(JSON.stringify(q.state)!==before)throw new Error('Scene draw mutated state');
      return {name:scene.name,...stats};
    },scene);
    await page.locator('#qa-scene').screenshot({path:`output/playwright/v02-${scene.name}.png`});frames.push(result);
  }
  const dials=await page.evaluate(()=>{
    const q=window.__qaScene,ctx=q.canvas.getContext('2d'),labels=[],original=ctx.fillText;
    ctx.fillText=function(text,...args){labels.push(String(text));return original.call(this,text,...args);};
    q.renderer.render(q.state,q.settings);ctx.fillText=original;
    for(const tick of ['20','40','60','80','100','120','140','160'])if(!labels.includes(tick))throw new Error(`Missing real MPH tick ${tick}`);
    if(labels.includes('77')||labels.includes('103')||labels.includes('129'))throw new Error('Fractional speed scale survived');
    q.canvas.remove();delete window.__qaScene;return labels;
  });
  return {frames,dials};
}
