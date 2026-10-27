async (page) => {
  await page.addInitScript(() => {
    window.__qaPad = { id: 'QA standard controller', index: 0, connected: true, mapping: 'standard', timestamp: 0,
      axes: [0, 0, 0, 0], buttons: Array.from({length: 17}, () => ({value: 0, pressed: false, touched: false})) };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [window.__qaPad] });
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.evaluate(async () => {
    const raw = await (await fetch('/output/qa/service-save.json')).text();
    localStorage.setItem('cannonball.pa.save.v1', raw);
  });
  await page.reload();
  await page.getByRole('button', {name: 'Fahrt fortsetzen', exact: true}).click();
  await page.waitForFunction(() => window.__cannonball.getState()?.status === 'service');
  const leave = page.getByRole('button', {name: 'Weiterfahren →', exact: true});
  await leave.focus();
  await page.evaluate(() => {window.__qaPad.buttons[0] = {value: 1, pressed: true, touched: true};});
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => {window.__qaPad.buttons[0] = {value: 0, pressed: false, touched: false};});
  const status = await page.evaluate(() => window.__cannonball.getState()?.status);
  if (status !== 'driving') throw new Error(`Controller A must leave service; actual status=${status}`);
  await page.keyboard.press('p');
  await page.getByRole('button', {name: 'Ansicht & Einstellungen', exact: true}).click();
  const sound = page.locator('#setting-sound');const before = await sound.isChecked();await sound.focus();
  await page.evaluate(() => {window.__qaPad.buttons[0] = {value: 1, pressed: true, touched: true};});
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => {window.__qaPad.buttons[0] = {value: 0, pressed: false, touched: false};});
  if (await sound.isChecked() === before) throw new Error('Controller A must activate focused settings checkbox');
  const after = await page.evaluate(() => window.__cannonball.getState()?.status);
  if (after !== 'paused') throw new Error('Settings interaction must keep world paused');
  return {passed:['controller-service-exit','checkbox-activation','modal-isolation']};
}
