import { mkdir, copyFile, readdir, readFile, writeFile, lstat, realpath } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceDefault = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDefault = 'D:\\Velvet Cruise\\WinExe';
const runtimeFiles = [
  'chrome_100_percent.pak', 'chrome_200_percent.pak', 'd3dcompiler_47.dll',
  'ffmpeg.dll', 'icudtl.dat', 'libEGL.dll', 'libGLESv2.dll',
  'LICENSE.electron.txt', 'LICENSES.chromium.html', 'resources.pak',
  'snapshot_blob.bin', 'v8_context_snapshot.bin', 'Velvet Cruise.exe',
  'vk_swiftshader_icd.json', 'vk_swiftshader.dll', 'vulkan-1.dll',
];
const inside = (root, target) => {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};

async function plainFile(file) {
  const info = await lstat(file).catch(error => { throw new Error(`Required file missing: ${file}`, { cause: error }); });
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Expected a regular file: ${file}`);
}

async function outputBoundary(workspace, target) {
  if (!inside(workspace, target)) throw new Error('Output must remain inside the workspace.');
  const parts = path.relative(workspace, target).split(path.sep).filter(Boolean);
  let current = workspace;
  for (const part of parts) {
    current = path.join(current, part);
    const info = await lstat(current).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (!info) break;
    if (info.isSymbolicLink()) throw new Error(`Output contains a symbolic link or junction: ${current}`);
    if (!inside(workspace, await realpath(current))) throw new Error(`Output resolves outside the workspace: ${current}`);
  }
}

async function copyPlainTree(source, destination) {
  const entries = await readdir(source, { withFileTypes: true });
  await mkdir(destination, { recursive: true });
  for (const entry of entries) {
    const from = path.join(source, entry.name), to = path.join(destination, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Cannot package symbolic links: ${from}`);
    if (entry.isDirectory()) await copyPlainTree(from, to);
    else if (entry.isFile()) await copyFile(from, to);
    else throw new Error(`Cannot package special files: ${from}`);
  }
}

async function fileInventory(root, relative = '') {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const name = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await fileInventory(root, name));
    else {
      const bytes = await readFile(path.join(root, name));
      files.push({ path: name.split(path.sep).join('/'), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
  }
  return files;
}

export async function buildWindows({ workspace = workspaceDefault, runtimeSource = runtimeDefault } = {}) {
  workspace = await realpath(path.resolve(workspace));
  runtimeSource = await realpath(path.resolve(runtimeSource));
  const outputParent = path.join(workspace, 'output', 'windows');
  let outputDirectory = path.join(outputParent, 'Cannonball-PA-Windows');
  const latest = path.join(outputParent, 'latest.json');
  const buildId = `${new Date().toISOString().replace(/[-:.]/g, '')}-${randomUUID().slice(0, 8)}`;
  const dist = path.join(workspace, 'dist');
  await outputBoundary(workspace, outputDirectory);
  await outputBoundary(workspace, latest);
  if (await lstat(outputDirectory).catch(error => { if (error.code === 'ENOENT') return null; throw error; })) {
    outputDirectory = path.join(outputParent, `Cannonball-PA-Windows-${buildId}`);
  }
  for (const name of runtimeFiles) await plainFile(path.join(runtimeSource, name));
  await plainFile(path.join(dist, 'index.html'));
  await plainFile(path.join(workspace, 'desktop', 'main.cjs'));
  if (!inside(workspace, await realpath(dist))) throw new Error('The browser build must be inside the workspace.');
  const localesRoot = path.join(runtimeSource, 'locales');
  if ((await lstat(localesRoot)).isSymbolicLink()) throw new Error('Runtime locales cannot be a symbolic link.');
  const locales = await readdir(localesRoot, { withFileTypes: true });
  if (!locales.length) throw new Error('Runtime locale files are missing.');
  for (const entry of locales) {
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith('.pak')) throw new Error(`Unexpected locale entry: ${entry.name}`);
  }
  const project = JSON.parse(await readFile(path.join(workspace, 'package.json'), 'utf8'));
  const html = await readFile(path.join(dist, 'index.html'), 'utf8');
  if (/\b(?:src|href)=["']\/(?!\/)/i.test(html)) throw new Error('Build contains absolute asset URLs. Build Vite with base: "./".');

  await mkdir(outputParent, { recursive: true });
  await outputBoundary(workspace, outputParent);
  await outputBoundary(workspace, outputDirectory);
  await mkdir(outputDirectory);
  for (const name of runtimeFiles) await copyFile(path.join(runtimeSource, name), path.join(outputDirectory, name === 'Velvet Cruise.exe' ? 'Cannonball.exe' : name));
  await mkdir(path.join(outputDirectory, 'locales'));
  for (const entry of locales) await copyFile(path.join(localesRoot, entry.name), path.join(outputDirectory, 'locales', entry.name));
  const appRoot = path.join(outputDirectory, 'resources', 'app');
  await mkdir(appRoot, { recursive: true });
  await writeFile(path.join(appRoot, 'package.json'), `${JSON.stringify({ name: 'cannonball-coast-to-coast', productName: 'Cannonball — Coast to Coast', version: project.version, private: true, main: 'main.cjs' }, null, 2)}\n`);
  await copyFile(path.join(workspace, 'desktop', 'main.cjs'), path.join(appRoot, 'main.cjs'));
  await copyPlainTree(dist, path.join(appRoot, 'game'));
  const files = await fileInventory(outputDirectory);
  const manifest = {
    schemaVersion: 1, buildId,
    product: 'Cannonball — Coast to Coast', version: project.version,
    builtAt: new Date().toISOString(), platform: 'win32', architecture: 'x64',
    runtime: { source: runtimeSource, executable: 'Cannonball.exe', reuse: 'Electron/Chromium runtime root files and locales only', originalExecutableMetadata: 'Retained from local prototype runtime; this is not a newly signed or rebranded binary.' },
    entry: 'resources/app/game/index.html',
    saveIdentity: { appName: 'Cannonball-Coast-to-Coast', userDataDirectory: '%APPDATA%/Cannonball-Coast-to-Coast', saveKey: 'cannonball.pa.save.v1', settingsKey: 'cannonball.pa.settings.v1' },
    files,
  };
  await writeFile(path.join(outputDirectory, 'build_manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const result = { schemaVersion: 1, buildId, builtAt: manifest.builtAt, outputDirectory, executable: path.join(outputDirectory, 'Cannonball.exe'), files: files.length, manifest: path.join(outputDirectory, 'build_manifest.json'), latest, nativeSmoke: null };
  await outputBoundary(workspace, latest);
  await writeFile(latest, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

async function nativeSmoke(result) {
  await outputBoundary(workspaceDefault, result.outputDirectory);
  if (path.resolve(result.executable) !== path.join(result.outputDirectory, 'Cannonball.exe') || !/^[A-Za-z0-9-]+$/.test(result.buildId)) throw new Error('Invalid native smoke package identity.');
  await plainFile(result.executable);
  const report = path.join(workspaceDefault, 'output', 'qa', `native-smoke-${result.buildId}`, 'report.json');
  const env = { ...process.env, CANNONBALL_SMOKE_REPORT: report };
  delete env.ELECTRON_RUN_AS_NODE;
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(result.executable, [], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    child.on('error', reject);
    child.on('exit', code => resolve(code ?? 1));
  });
  const reportResult = JSON.parse(await readFile(report, 'utf8'));
  if (exitCode !== 0 || reportResult.ok !== true) throw new Error(`Native smoke failed; inspect ${report}`);
  return { report, screenshot: reportResult.screenshot, ok: true, electron: reportResult.versions.electron };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arguments_ = process.argv.slice(2);
  try {
    let runtimeSource = runtimeDefault, smoke = false, smokeOnly = false;
    for (let index = 0; index < arguments_.length; index++) {
      if (arguments_[index] === '--runtime' && arguments_[index + 1]) runtimeSource = arguments_[++index];
      else if (arguments_[index] === '--smoke') smoke = true;
      else if (arguments_[index] === '--smoke-only') smokeOnly = true;
      else throw new Error('Usage: node tools/build-windows.mjs [--runtime <Electron runtime directory>] [--smoke | --smoke-only]');
    }
    const result = smokeOnly ? JSON.parse(await readFile(path.join(workspaceDefault, 'output', 'windows', 'latest.json'), 'utf8')) : await buildWindows({ runtimeSource });
    if (smoke || smokeOnly) {
      result.nativeSmoke = await nativeSmoke(result);
      const latest = path.join(workspaceDefault, 'output', 'windows', 'latest.json');
      await outputBoundary(workspaceDefault, latest);
      await writeFile(latest, `${JSON.stringify(result, null, 2)}\n`);
    }
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
