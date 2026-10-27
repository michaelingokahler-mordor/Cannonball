import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const runtimeFiles = [
  'chrome_100_percent.pak', 'chrome_200_percent.pak', 'd3dcompiler_47.dll',
  'ffmpeg.dll', 'icudtl.dat', 'libEGL.dll', 'libGLESv2.dll',
  'LICENSE.electron.txt', 'LICENSES.chromium.html', 'resources.pak',
  'snapshot_blob.bin', 'v8_context_snapshot.bin', 'Velvet Cruise.exe',
  'vk_swiftshader_icd.json', 'vk_swiftshader.dll', 'vulkan-1.dll',
];

async function builder() {
  const module = await import('../tools/build-windows.mjs');
  assert.equal(typeof module.buildWindows, 'function', 'portable Windows builder must be available');
  return module.buildWindows;
}

async function fixture(t: any) {
  const root = await mkdtemp(path.join(tmpdir(), 'cannonball-package-test-'));
  t.after(async () => {
    assert.equal(path.dirname(root), tmpdir());
    assert.ok(path.basename(root).startsWith('cannonball-package-test-'));
    await rm(root, { recursive: true, force: true });
  });
  const workspace = path.join(root, 'workspace');
  const runtimeSource = path.join(root, 'runtime');
  await Promise.all(['dist/assets', 'desktop'].map(dir => mkdir(path.join(workspace, dir), { recursive: true })));
  await mkdir(path.join(runtimeSource, 'locales'), { recursive: true });
  await mkdir(path.join(runtimeSource, 'resources'), { recursive: true });
  await Promise.all(runtimeFiles.map(name => writeFile(path.join(runtimeSource, name), `runtime:${name}`)));
  await writeFile(path.join(runtimeSource, 'locales/en-US.pak'), 'locale');
  await writeFile(path.join(runtimeSource, 'resources/app.asar'), 'OLD PRIVATE APPLICATION');
  await writeFile(path.join(runtimeSource, 'old-config.json'), 'OLD PRIVATE CONFIG');
  await writeFile(path.join(workspace, 'dist/index.html'), '<script src="./assets/game.js"></script>');
  await writeFile(path.join(workspace, 'dist/assets/game.js'), 'own game');
  await writeFile(path.join(workspace, 'desktop/main.cjs'), '// own desktop entry');
  await writeFile(path.join(workspace, 'package.json'), JSON.stringify({ name: 'cannonball-coast-to-coast', version: '0.1.0' }));
  return { root, workspace, runtimeSource };
}

test('portable package contains fresh app and runtime notices without old application resources', async t => {
  const buildWindows = await builder();
  const options = await fixture(t);
  const { outputDirectory } = await buildWindows(options);
  assert.equal(path.relative(options.workspace, outputDirectory), path.join('output', 'windows', 'Cannonball-PA-Windows'));
  assert.equal(await readFile(path.join(outputDirectory, 'Cannonball.exe'), 'utf8'), 'runtime:Velvet Cruise.exe');
  assert.deepEqual(await readdir(path.join(outputDirectory, 'resources')), ['app']);
  assert.equal(await readFile(path.join(outputDirectory, 'resources/app/game/assets/game.js'), 'utf8'), 'own game');
  assert.equal(await readFile(path.join(outputDirectory, 'LICENSE.electron.txt'), 'utf8'), 'runtime:LICENSE.electron.txt');
  await assert.rejects(access(path.join(outputDirectory, 'old-config.json')));
  await assert.rejects(access(path.join(outputDirectory, 'Velvet Cruise.exe')));
  const manifest = JSON.parse(await readFile(path.join(outputDirectory, 'build_manifest.json'), 'utf8'));
  assert.equal(manifest.saveIdentity.userDataDirectory, '%APPDATA%/Cannonball-Coast-to-Coast');
  assert.equal(manifest.files.find((file: any) => file.path === 'resources/app/game/assets/game.js').sha256.length, 64);
  assert.equal(manifest.files.some((file: any) => file.path === 'resources/app.asar'), false);
});

test('missing runtime files fail before a previous package is changed', async t => {
  const buildWindows = await builder();
  const options = await fixture(t);
  const output = path.join(options.workspace, 'output/windows/Cannonball-PA-Windows');
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'previous.txt'), 'preserve this package');
  await rm(path.join(options.runtimeSource, 'LICENSE.electron.txt'));
  await assert.rejects(buildWindows(options), /LICENSE.electron.txt/);
  assert.equal(await readFile(path.join(output, 'previous.txt'), 'utf8'), 'preserve this package');
});

test('a repeated build uses a fresh sibling and latest.json without changing its predecessor', async t => {
  const buildWindows = await builder();
  const options = await fixture(t);
  const first = await buildWindows(options);
  await writeFile(path.join(first.outputDirectory, 'leave-this-alone.txt'), 'older delivery');
  const second = await buildWindows(options);
  assert.notEqual(second.outputDirectory, first.outputDirectory);
  assert.equal(path.dirname(second.outputDirectory), path.dirname(first.outputDirectory));
  assert.ok(path.basename(second.outputDirectory).startsWith('Cannonball-PA-Windows-'));
  assert.equal(await readFile(path.join(first.outputDirectory, 'leave-this-alone.txt'), 'utf8'), 'older delivery');
  const latest = JSON.parse(await readFile(path.join(options.workspace, 'output/windows/latest.json'), 'utf8'));
  assert.equal(latest.outputDirectory, second.outputDirectory);
  assert.equal(latest.executable, path.join(second.outputDirectory, 'Cannonball.exe'));
});

test('a junction outside the workspace is rejected before writing a package', async t => {
  const buildWindows = await builder();
  const options = await fixture(t);
  const external = path.join(options.root, 'external');
  await mkdir(external);
  await writeFile(path.join(external, 'sentinel.txt'), 'keep');
  await symlink(external, path.join(options.workspace, 'output'), 'junction');
  await assert.rejects(buildWindows(options), /outside|junction|symbolic|workspace/i);
  assert.deepEqual(await readdir(external), ['sentinel.txt']);
});
