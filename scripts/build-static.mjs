import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const PROJECT_ROOT = fs.realpathSync(path.resolve(path.dirname(SCRIPT_PATH), '..'));

export const PUBLIC_FILES = Object.freeze([
  '404.html', 'about.html', 'contact.html', 'cookie-notice.html', 'faq.html', 'groups-talks.html',
  'index.html', 'kaleidoscope-colour-analysis.html', 'make-up-masterclass.html',
  'personal-shopping.html', 'pocket-stylist.html', 'privacy-policy.html',
  'services.html', 'signature-style-analysis.html', 'terms-and-conditions.html',
  'testimonials.html', 'travel-light.html', 'wardrobe-edit.html',
  'robots.txt', 'sitemap.xml', 'site.webmanifest'
]);

// These are build inputs or internal files, never static publication inputs.
const INTERNAL_ENTRIES = new Set([
  '.git', '.gitignore', '.github', '.vercel', '.vercelignore', '.openai', '.env.example', '.env.local', 'api',
  'node_modules', 'package.json', 'package-lock.json', 'scripts', 'tests',
  'vercel.json', 'README.md', 'QA-REPORT.txt'
]);
const ASSET_EXTENSIONS = Object.freeze({
  css: new Set(['.css']),
  js: new Set(['.js']),
  fonts: new Set(['.ttf', '.otf', '.woff', '.woff2']),
  img: new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.ico'])
});

function isInside(parent, target) {
  const relative = path.relative(parent, target);
  return relative !== '' && !path.isAbsolute(relative) &&
    relative !== '..' && !relative.startsWith(`..${path.sep}`);
}

function safeEntry(filename, parent) {
  const stat = fs.lstatSync(filename);
  if (stat.isSymbolicLink()) throw new Error(`Refusing a symbolic link: ${path.relative(parent, filename)}`);
  if (!stat.isFile() && !stat.isDirectory()) throw new Error(`Refusing a non-regular entry: ${path.relative(parent, filename)}`);
  const resolved = fs.realpathSync(filename);
  if (!isInside(parent, resolved)) throw new Error('An entry resolves outside the approved project directory.');
  return stat;
}

function collectAssets(directory, projectRoot, allowedExtensions, files) {
  const stat = safeEntry(directory, projectRoot);
  if (!stat.isDirectory()) throw new Error('An approved asset directory is not a directory.');
  for (const name of fs.readdirSync(directory).sort()) {
    const filename = path.join(directory, name);
    const entry = safeEntry(filename, projectRoot);
    if (entry.isDirectory()) collectAssets(filename, projectRoot, allowedExtensions, files);
    else {
      if (!allowedExtensions.has(path.extname(name).toLowerCase())) {
        throw new Error(`Unapproved asset file: ${path.relative(projectRoot, filename)}`);
      }
      files.push(path.relative(projectRoot, filename));
    }
  }
}

function checkOutputTree(directory, outputRoot) {
  for (const name of fs.readdirSync(directory)) {
    const filename = path.join(directory, name);
    const stat = safeEntry(filename, outputRoot);
    if (stat.isDirectory()) checkOutputTree(filename, outputRoot);
  }
}

export function buildStatic(sourceRoot = PROJECT_ROOT) {
  const projectRoot = fs.realpathSync(sourceRoot);
  if (projectRoot === path.parse(projectRoot).root) throw new Error('Refusing to build from a filesystem root.');
  const output = path.resolve(projectRoot, 'public');
  if (path.dirname(output) !== projectRoot || path.basename(output) !== 'public' || !isInside(projectRoot, output)) {
    throw new Error('The output must be the exact public directory within this project.');
  }

  // Validate every publication input BEFORE clearing an existing successful build.
  const approvedTopLevel = new Set([...PUBLIC_FILES, ...INTERNAL_ENTRIES, 'assets', 'public']);
  for (const name of fs.readdirSync(projectRoot)) {
    if (!approvedTopLevel.has(name)) throw new Error(`Unapproved top-level entry: ${name}`);
    safeEntry(path.join(projectRoot, name), projectRoot);
  }
  const files = [...PUBLIC_FILES];
  for (const filename of PUBLIC_FILES) {
    if (!safeEntry(path.join(projectRoot, filename), projectRoot).isFile()) {
      throw new Error(`An approved website page/file is not a regular file: ${filename}`);
    }
  }
  const assets = path.join(projectRoot, 'assets');
  if (!safeEntry(assets, projectRoot).isDirectory()) throw new Error('assets must be a regular directory.');
  const categories = fs.readdirSync(assets).sort();
  for (const category of categories) {
    if (!Object.hasOwn(ASSET_EXTENSIONS, category)) throw new Error(`Unapproved asset category: ${category}`);
    collectAssets(path.join(assets, category), projectRoot, ASSET_EXTENSIONS[category], files);
  }
  for (const category of Object.keys(ASSET_EXTENSIONS)) {
    if (!categories.includes(category)) throw new Error(`Missing required asset category: ${category}`);
  }

  if (fs.existsSync(output)) {
    const stat = fs.lstatSync(output);
    if (stat.isSymbolicLink() || !stat.isDirectory() || fs.realpathSync(output) !== output) {
      throw new Error('Refusing to clear an unsafe public output target.');
    }
    checkOutputTree(output, output);
    // This exact, canonical repo/public target was validated above. Never delete
    // the project root, a caller-supplied arbitrary output, or a linked directory.
    fs.rmSync(output, { recursive: true, force: false });
  }
  fs.mkdirSync(output);
  for (const filename of files) {
    const destination = path.resolve(output, filename);
    if (!isInside(output, destination)) throw new Error('A publication path escaped the output directory.');
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(projectRoot, filename), destination);
  }
  return { output, files: files.map(filename => filename.split(path.sep).join('/')).sort() };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === SCRIPT_PATH) {
  if (process.argv.length !== 2) throw new Error('This build accepts no paths or extra arguments.');
  const result = buildStatic();
  console.log(`Built ${result.files.length} approved static files into public. Root /api functions are not copied.`);
}
