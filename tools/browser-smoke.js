async (page) => {
  const failures=[];page.on('pageerror',error=>failures.push(error.message));
  await page.setViewportSize({width:1440,height:960});
  await page.goto('http://127.0.0.1:5173/');
  await page.evaluate(()=>{localStorage.removeItem('cannonball.pa.save.v1');localStorage.removeItem('cannonball.pa.settings.v1');});
  await page.reload();
  if(!(await page.locator('body').innerText()).includes('70ER-ÄRA'))throw new Error('Era heading missing');
  await page.screenshot({path:'output/playwright/01-home-final.png',fullPage:true});
  await page.getByRole('button',{name:'Motor starten →'}).click();
  await page.waitForFunction(()=>window.__cannonball.getState()?.status==='driving');
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(()=>window.__cannonball.getState()?.speed>45);
  if(await page.evaluate(()=>window.__cannonball.getState().gear)!==1)throw new Error('Manual car shifted itself');
  await page.keyboard.press('r');
  await page.waitForFunction(()=>window.__cannonball.getState().gear===2);
  await page.keyboard.up('ArrowUp');await page.keyboard.press('p');
  await page.waitForFunction(()=>window.__cannonball.getState().status==='paused');
  const frozen=await page.evaluate(()=>JSON.stringify(window.__cannonball.getState()));
  await page.getByRole('button',{name:'Ansicht & Einstellungen',exact:true}).click();
  const cases=[];
  for(const resolution of ['640x360','1280x720']){
    await page.locator('#setting-resolution').selectOption(resolution);
    for(const view of ['arcade','cockpit']){
      await page.locator('#setting-view').selectOption(view);
      await page.waitForFunction(([w,h])=>{const c=document.querySelector('canvas');return c.width===w&&c.height===h;},resolution.split('x').map(Number));
      const state=await page.evaluate(()=>JSON.stringify(window.__cannonball.getState()));
      if(state!==frozen)throw new Error(`${view}/${resolution} changed the journey`);
      cases.push({resolution,view,...await page.evaluate(()=>window.__cannonball.getRenderStats())});
    }
  }
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await page.waitForFunction(()=>window.__cannonball.getState().status==='driving');
  await page.locator('canvas').screenshot({path:'output/playwright/03-cockpit-final.png'});
  await page.keyboard.press('c');
  await page.waitForFunction(()=>window.__cannonball.getSettings().view==='arcade');
  await page.locator('canvas').screenshot({path:'output/playwright/02-arcade-final.png'});
  await page.keyboard.press('m');
  await page.waitForFunction(()=>window.__cannonball.getSettings().map);
  await page.locator('canvas').screenshot({path:'output/playwright/04-paper-map.png'});
  await page.keyboard.press('p');

  // Service UI fixture uses the public, strictly validated snapshot format.
  await page.evaluate(async()=>localStorage.setItem('cannonball.pa.save.v1',await(await fetch('/output/qa/service-save.json')).text()));
  await page.reload();await page.getByRole('button',{name:'Fahrt fortsetzen',exact:true}).click();
  await page.waitForFunction(()=>window.__cannonball.getState()?.status==='service');
  const before=await page.evaluate(()=>window.__cannonball.getState());
  await page.getByRole('button',{name:/Volltanken/}).click();
  const after=await page.evaluate(()=>window.__cannonball.getState());
  if(after.elapsed-before.elapsed!==420)throw new Error('Fuel stop must charge exactly7virtual minutes');
  if(after.fatigue[0]!==Math.max(0,before.fatigue[0]-3))throw new Error('Incorrect small fuel-stop rest');
  await page.getByRole('button',{name:/Fahrer wechseln/}).click();
  const swapped=await page.evaluate(()=>window.__cannonball.getState());
  if(swapped.activeDriver===after.activeDriver||swapped.elapsed!==after.elapsed||JSON.stringify(swapped.fatigue)!==JSON.stringify(after.fatigue))throw new Error('Driver swap must change roles without healing or time cost');
  await page.getByRole('button',{name:'Sicher speichern',exact:true}).click();
  const saved=await page.evaluate(()=>JSON.stringify(window.__cannonball.getState()));
  await page.getByRole('button',{name:'Sicher speichern',exact:true}).click();
  if(await page.evaluate(()=>JSON.stringify(window.__cannonball.getState()))!==saved)throw new Error('Saving healed or changed state');
  await page.locator('dialog').screenshot({path:'output/playwright/05-service.png'});
  await page.reload();await page.getByRole('button',{name:'Fahrt fortsetzen',exact:true}).click();
  if(await page.evaluate(()=>JSON.stringify(window.__cannonball.getState()))!==saved)throw new Error('Reload did not restore exact service');
  await page.getByRole('button',{name:'Weiterfahren →',exact:true}).click();
  await page.waitForFunction(()=>window.__cannonball.getState().status==='driving');
  await page.keyboard.press('p');
  if(failures.length)throw new Error(failures.join('; '));
  return {passed:['manual-input','four-camera-resolution-cases','map','fixed-service-cost','driver-swap','save-no-healing','exact-reload','service-exit'],renderCases:cases,pageErrors:failures};
}
