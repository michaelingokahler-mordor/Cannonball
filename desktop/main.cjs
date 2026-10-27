'use strict';
const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL, fileURLToPath } = require('node:url');

const title = 'Cannonball — Coast to Coast';
const appName = 'Cannonball-Coast-to-Coast';
const smokeReport = process.env.CANNONBALL_SMOKE_REPORT;
if (smokeReport && !path.isAbsolute(smokeReport)) throw new Error('CANNONBALL_SMOKE_REPORT must be an absolute path.');
app.setName(appName);
const normalUserData = path.join(app.getPath('appData'), appName);
app.setPath('userData', smokeReport ? path.join(normalUserData, 'Native-Smoke-Profile') : normalUserData);

const gameRoot = path.join(__dirname, 'game');
const indexFile = path.join(gameRoot, 'index.html');
const entryUrl = pathToFileURL(indexFile).href;
const rendererErrors = [];
let window;
let finished = false;
const trustedFile = url => {
  try {
    if (new URL(url).protocol !== 'file:') return false;
    const relative = path.relative(gameRoot, fileURLToPath(url));
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
  } catch { return false; }
};

async function finishSmoke(result, exitCode) {
  if (finished) return;
  finished = true;
  clearTimeout(smokeTimeout);
  const report = { product: title, ok: exitCode === 0, at: new Date().toISOString(), platform: process.platform, architecture: process.arch, versions: process.versions, userData: app.getPath('userData'), normalUserData, rendererErrors, ...result };
  try {
    await fs.mkdir(path.dirname(smokeReport), { recursive: true });
    await fs.writeFile(smokeReport, `${JSON.stringify(report, null, 2)}\n`);
  } catch (error) { console.error(error); exitCode = 1; }
  app.exit(exitCode);
}

const smokeTimeout = smokeReport ? setTimeout(() => finishSmoke({ error: 'Native smoke timed out before completing.' }, 1), 30000) : null;

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !(trustedFile(details.url) || details.url.startsWith('data:') || details.url.startsWith('blob:')) });
  });
  window = new BrowserWindow({
    title, width: 1440, height: 960, minWidth: 960, minHeight: 640,
    backgroundColor: '#142b2c', show: !smokeReport, autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, backgroundThrottling: !smokeReport, paintWhenInitiallyHidden: true, devTools: false },
  });
  window.setMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (url !== entryUrl) event.preventDefault(); });
  window.webContents.on('will-frame-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('console-message', (_event, level, message) => { if (level >= 3) rendererErrors.push({ type: 'console', message }); });
  window.webContents.on('render-process-gone', (_event, details) => {
    rendererErrors.push({ type: 'render-process-gone', ...details });
    if (smokeReport) finishSmoke({ error: 'Renderer process stopped.' }, 1);
  });
  window.webContents.on('did-fail-load', (_event, code, message, url, isMainFrame) => {
    rendererErrors.push({ type: 'did-fail-load', code, message, url });
    if (smokeReport && isMainFrame) finishSmoke({ error: `Local page failed: ${message}` }, 1);
  });
  if (smokeReport) window.webContents.once('did-finish-load', async () => {
    try {
      const home = await window.webContents.executeJavaScript(`(() => ({ title: document.title, homeVisible: !!document.querySelector('.roadbook-home:not([hidden])'), startAvailable: !!document.querySelector('.start-drive'), body: document.body.innerText.slice(0, 1800), nodeExposed: typeof process !== 'undefined' || typeof require !== 'undefined' }))()`);
      if (!home.homeVisible || !home.startAvailable || home.title !== title || home.nodeExposed) throw new Error('Fresh Cannonball home or renderer isolation check failed.');
      await window.webContents.executeJavaScript(`document.querySelector('.start-drive').click(); true`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      const play = await window.webContents.executeJavaScript(`(() => { const canvas=document.querySelector('canvas'); const box=canvas?.getBoundingClientRect(); return { title: document.title, playVisible: !!document.querySelector('.play-area:not([hidden])'), homeHidden: !!document.querySelector('.roadbook-home[hidden]'), canvas: canvas ? { width: canvas.width, height: canvas.height, displayWidth: box.width, displayHeight: box.height } : null, body: document.body.innerText.slice(0, 1800) }; })()`);
      const screenshot = path.join(path.dirname(smokeReport), 'native.png');
      await fs.mkdir(path.dirname(smokeReport), { recursive: true });
      const capture = await window.webContents.capturePage();
      await fs.writeFile(screenshot, capture.toPNG());
      const ok = play.playVisible && play.homeHidden && play.canvas?.width > 0 && play.canvas?.height > 0 && rendererErrors.length === 0 && !capture.isEmpty();
      await finishSmoke({ home, play, screenshot, screenshotSize: capture.getSize(), loadedUrl: window.webContents.getURL(), browserWindowTitle: window.getTitle(), security: { contextIsolation: true, nodeIntegration: false, sandbox: true, externalNavigation: 'blocked' } }, ok ? 0 : 1);
    } catch (error) { await finishSmoke({ error: error.stack || error.message }, 1); }
  });
  await window.loadFile(indexFile);
}).catch(error => {
  if (smokeReport) finishSmoke({ error: error.stack || error.message }, 1);
  else { console.error(error); app.quit(); }
});
app.on('window-all-closed', () => app.quit());
