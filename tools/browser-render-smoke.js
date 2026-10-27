async (page) => {
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button',{name:'Motor starten →'}).click();
  await page.waitForFunction(()=>window.__cannonball.getState()?.status==='driving');
  await page.keyboard.press('p');
  await page.waitForFunction(()=>window.__cannonball.getState().status==='paused');
  const frozen=await page.evaluate(()=>JSON.stringify(window.__cannonball.getState()));
  const report=await page.evaluate(async()=>{
    const {GameRenderer}=await import('/src/render.ts');
    const canvas=document.createElement('canvas');const renderer=new GameRenderer(canvas);
    const state=window.__cannonball.getState();state.status='paused';state.distance=50000;
    state.traffic=[
      {id:'front-fixture',distance:50200,x:.75,speed:80,color:'#c87835',body:'sedan',oncoming:false,role:'traffic'},
      {id:'rear-police-fixture',distance:49800,x:.25,speed:200,color:'#eee5ce',body:'sedan',oncoming:false,role:'police'},
    ];
    const original=JSON.stringify(state),cases=[];
    for(const resolution of ['640x360','1280x720'])for(const view of ['arcade','cockpit']){
      const stats=renderer.render(state,{resolution,view,map:false,units:'kmh',sound:false,speech:false});
      if(JSON.stringify(state)!==original)throw new Error('Drawing changed simulation state');
      const [w,h]=resolution.split('x').map(Number);
      if(canvas.width!==w||canvas.height!==h)throw new Error('Not a native backing buffer');
      if(stats.objects!==1||stats.mirrorObjects!==1)throw new Error('Front/rear world entity mismatch');
      cases.push({resolution,view,...stats});
    }
    for(const status of ['driving','paused','failed']){
      state.status=status;state.traffic=[];renderer.render(state,{resolution:'640x360',view:'arcade',map:true,units:'mph',sound:false,speech:false});
    }
    return cases;
  });
  if(await page.evaluate(()=>JSON.stringify(window.__cannonball.getState()))!==frozen)throw new Error('Render harness affected actual journey');
  return {passed:['read-only-rendering','native-buffers','real-rear-entity','empty-traffic','all-statuses'],cases:report};
}
