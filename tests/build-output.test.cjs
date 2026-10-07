'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const buildModule = import('../scripts/build-static.mjs');

function fixture(t, publicFiles) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'papillon-static-build-test-'));
  const canonical = fs.realpathSync(directory);
  assert.equal(path.dirname(canonical), fs.realpathSync(os.tmpdir()));
  assert.ok(path.basename(canonical).startsWith('papillon-static-build-test-'));
  t.after(() => {
    // Only remove this exact test-owned temporary directory, never repo/public.
    assert.equal(fs.realpathSync(directory), canonical);
    assert.equal(path.dirname(canonical), fs.realpathSync(os.tmpdir()));
    fs.rmSync(canonical, { recursive: true, force: false });
  });
  for (const name of publicFiles) fs.writeFileSync(path.join(directory, name), `Approved static content: ${name}`);
  for (const name of ['api', 'tests', 'scripts', '.openai']) fs.mkdirSync(path.join(directory, name));
  for (const [name, content] of [
    ['api/contact.js', 'module.exports = function handler() {};'],
    ['tests/contact.test.cjs', 'Internal test source, never publish.'],
    ['scripts/private-tool.mjs', 'Internal build script, never publish.'],
    ['.openai/hosting.json', 'Internal hosting configuration, never publish.'],
    ['.env.example', 'SMTP_USER=\nSMTP_PASS=\n'],
    ['.env.local', 'TEST_ONLY_NOT_A_REAL_SECRET=local-only-fixture\n'],
    ['package.json', '{}'], ['package-lock.json', '{}'], ['vercel.json', '{}'],
    ['README.md', 'Internal README, never publish.'], ['QA-REPORT.txt', 'Internal QA report, never publish.']
  ]) fs.writeFileSync(path.join(directory, name), content);
  for (const name of ['css', 'js', 'fonts', 'img']) fs.mkdirSync(path.join(directory, 'assets', name), { recursive: true });
  for (const [name, content] of [
    ['assets/css/site.css', 'body { color: black; }'],
    ['assets/css/no-script.css', '[data-contact-form] { display:none; }'],
    ['assets/js/site.js', '/* approved browser script */'],
    ['assets/fonts/font.woff2', 'font fixture'],
    ['assets/img/image.webp', 'image fixture']
  ]) fs.writeFileSync(path.join(directory, name), content);
  return directory;
}

function filesIn(directory, base = directory) {
  const result = [];
  for (const name of fs.readdirSync(directory).sort()) {
    const filename = path.join(directory, name);
    if (fs.lstatSync(filename).isDirectory()) result.push(...filesIn(filename, base));
    else result.push(path.relative(base, filename).split(path.sep).join('/'));
  }
  return result.sort();
}

function junction(t, target, link) {
  // Windows junctions do not require developer-mode symlink privileges.
  fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  t.after(() => { if (fs.existsSync(link)) fs.unlinkSync(link); });
}

test('explicit publication includes every approved page/asset and excludes all internal source', async t => {
  const { buildStatic, PUBLIC_FILES } = await buildModule;
  const root = fixture(t, PUBLIC_FILES);
  const result = buildStatic(root);
  assert.equal(result.output, path.join(fs.realpathSync(root), 'public'));
  assert.ok(PUBLIC_FILES.includes('cookie-notice.html'));
  assert.equal(PUBLIC_FILES.filter(name => name.endsWith('.html')).length, 18);
  const expected = [...PUBLIC_FILES, 'assets/css/site.css', 'assets/css/no-script.css', 'assets/js/site.js', 'assets/fonts/font.woff2', 'assets/img/image.webp'].sort();
  assert.deepEqual(result.files, expected);
  assert.deepEqual(filesIn(result.output), expected);
  for (const name of expected) {
    assert.deepEqual(fs.readFileSync(path.join(result.output, name)), fs.readFileSync(path.join(root, name)));
  }
  for (const name of ['api', 'tests', 'scripts', '.openai', '.env.example', '.env.local', 'package.json', 'package-lock.json', 'vercel.json', 'README.md', 'QA-REPORT.txt']) {
    assert.equal(fs.existsSync(path.join(result.output, name)), false, name);
    assert.equal(fs.existsSync(path.join(root, name)), true, `${name} source must be preserved`);
  }
});

test('repeated builds clean only canonical project/public and produce identical publication files', async t => {
  const { buildStatic, PUBLIC_FILES } = await buildModule;
  const root = fixture(t, PUBLIC_FILES);
  const first = buildStatic(root);
  fs.writeFileSync(path.join(first.output, 'stale-private.txt'), 'Must not survive a rebuild');
  const second = buildStatic(root);
  assert.deepEqual(first.files, second.files);
  assert.equal(fs.existsSync(path.join(second.output, 'stale-private.txt')), false);
  assert.equal(fs.readFileSync(path.join(root, 'api/contact.js'), 'utf8'), 'module.exports = function handler() {};');
  assert.equal(fs.existsSync(path.join(root, 'README.md')), true);
});

test('unknown top-level file/page stops before touching a previous successful build', async t => {
  const { buildStatic, PUBLIC_FILES } = await buildModule;
  for (const name of ['private.html', 'notes.txt']) {
    const root = fixture(t, PUBLIC_FILES);
    const first = buildStatic(root);
    fs.writeFileSync(path.join(first.output, 'preserve-on-invalid-input.txt'), 'keep');
    fs.writeFileSync(path.join(root, name), 'Not reviewed for publication');
    assert.throws(() => buildStatic(root), /Unapproved top-level entry/);
    assert.equal(fs.readFileSync(path.join(first.output, 'preserve-on-invalid-input.txt'), 'utf8'), 'keep');
  }
});

test('unknown asset categories and non-static asset files fail closed', async t => {
  const { buildStatic, PUBLIC_FILES } = await buildModule;
  const categoryRoot = fixture(t, PUBLIC_FILES);
  fs.mkdirSync(path.join(categoryRoot, 'assets', 'internal'));
  assert.throws(() => buildStatic(categoryRoot), /Unapproved asset category/);
  const extensionRoot = fixture(t, PUBLIC_FILES);
  fs.writeFileSync(path.join(extensionRoot, 'assets', 'img', 'private.docx'), 'not a public image');
  assert.throws(() => buildStatic(extensionRoot), /Unapproved asset file/);
});

test('missing approved page fails before clearing existing output', async t => {
  const { buildStatic, PUBLIC_FILES } = await buildModule;
  const root = fixture(t, PUBLIC_FILES);
  const first = buildStatic(root);
  fs.unlinkSync(path.join(root, 'index.html'));
  assert.throws(() => buildStatic(root), /ENOENT/);
  assert.equal(fs.existsSync(path.join(first.output, 'index.html')), true);
});

test('symlinked output target cannot cause deletion outside this project', async t => {
  const { buildStatic, PUBLIC_FILES } = await buildModule;
  const root = fixture(t, PUBLIC_FILES);
  const outside = fixture(t, PUBLIC_FILES);
  fs.writeFileSync(path.join(outside, 'keep.txt'), 'outside remains safe');
  junction(t, outside, path.join(root, 'public'));
  assert.throws(() => buildStatic(root), /symbolic link|unsafe public/);
  assert.equal(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8'), 'outside remains safe');
});

test('symlinks within source assets or old output are rejected without following them', async t => {
  const { buildStatic, PUBLIC_FILES } = await buildModule;
  const outside = fixture(t, PUBLIC_FILES);
  const source = fixture(t, PUBLIC_FILES);
  junction(t, outside, path.join(source, 'assets', 'img', 'linked'));
  assert.throws(() => buildStatic(source), /symbolic link/);
  const outputRoot = fixture(t, PUBLIC_FILES);
  const first = buildStatic(outputRoot);
  junction(t, outside, path.join(first.output, 'linked'));
  assert.throws(() => buildStatic(outputRoot), /symbolic link/);
  assert.equal(fs.existsSync(path.join(first.output, 'index.html')), true);
  assert.equal(fs.existsSync(path.join(outside, 'api', 'contact.js')), true);
});

test('Vercel config publishes only public while retaining root API discovery', () => {
  const root = path.join(__dirname, '..');
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(config.outputDirectory, 'public');
  assert.equal(config.buildCommand, 'npm run build');
  assert.equal(pkg.scripts.build, 'node scripts/build-static.mjs');
  assert.equal(fs.existsSync(path.join(root, 'api', 'contact.js')), true);
  assert.ok(fs.readFileSync(path.join(root, '.gitignore'), 'utf8').split(/\r?\n/).includes('/public/'));
});
