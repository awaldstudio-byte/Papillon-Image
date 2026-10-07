import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const css = readFileSync(`${repo}/assets/css/master-copy.css`, 'utf8');
const html = readFileSync(`${repo}/index.html`, 'utf8');
const hero = html.match(/<section class="hero">[\s\S]*?<\/section>/)?.[0];

assert.ok(hero, 'Homepage retains a semantic hero section.');
assert.ok(hero.indexOf('class="hero-media"') < hero.indexOf('class="wrap hero-content"'), 'Approved photography comes before the copy.');
assert.ok(hero.includes('assets/img/helga-consultation.jpg'), 'The original approved consultation photograph is retained.');
assert.ok(hero.includes('True style isn’t acquired — it’s revealed.'), 'The approved master headline is unchanged.');
assert.ok(hero.includes('width="1600" height="1490"'), 'Image dimensions reserve its intrinsic ratio.');
assert.match(css, /\.hero\{[^}]*display:grid;[^}]*grid-template-columns:minmax\(0,1\.12fr\) minmax\(0,1fr\)/, 'Desktop separates image and copy.');
assert.match(css, /\.hero-media\{position:relative;inset:auto;/, 'Photography cannot sit underneath the copy region.');
assert.match(css, /\.hero::after\{display:none\}/, 'The former full-bleed text overlay is disabled.');
assert.match(css, /@media\(max-width:860px\)\{\s*\.hero\{grid-template-columns:1fr\}/, 'Narrow screens stack photo and copy.');
assert.match(css, /\.text-link\{display:inline-block;align-self:flex-start;[^}]*padding-right:1\.7rem;/, 'Text links reserve arrow space and do not stretch across cards.');
assert.match(css, /\.text-link::before,\.text-link::after\{[^}]*position:absolute;[^}]*top:50%;/, 'Both arrow parts use the same positioning context.');
assert.match(css, /\.text-link:hover::before\{transform:translate\(2px,-50%\)\}/, 'Hover moves the shaft horizontally without clipping.');
assert.match(css, /\.text-link:hover::after\{transform:translate\(2px,-50%\) rotate\(45deg\)\}/, 'Hover keeps the arrowhead attached to the shaft.');

function luminance(hex) {
  const [r, g, b] = hex.match(/[0-9a-f]{2}/gi).map(part => parseInt(part, 16) / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(foreground, background) {
  const first = luminance(foreground), second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
const contrastPairs = [
  ['Coral buttons, cost section and featured cards', '#211D1F', '#F17179'],
  ['Coral button hover', '#FFFFFF', '#A53645'],
  ['Eyebrows and wordmark on cream', '#A53645', '#FFF9F5'],
  ['Eyebrows on white', '#A53645', '#FFFFFF'],
  ['Eyebrows on pale sky', '#A53645', '#DCEFF3'],
  ['CTA text on sky', '#211D1F', '#8FC6D6'],
  ['Footer hover text', '#F17179', '#171416'],
];
for (const [label, foreground, background] of contrastPairs) {
  const ratio = contrast(foreground, background);
  assert.ok(ratio >= 4.5, `${label}: ${ratio.toFixed(2)}:1 must meet the normal-text contrast threshold.`);
  console.log(`${label}: ${ratio.toFixed(2)}:1`);
}
assert.match(css, /\.button\.coral\{color:var\(--ink\)\}/, 'Coral button labels use ink.');
assert.match(css, /\.price-card\.featured,\.price-card\.featured p\{color:var\(--ink\)\}/, 'Featured card copy uses ink.');
assert.match(css, /\.cost-section,\.cost-section \.eyebrow\{color:var\(--ink\)\}/, 'Cost copy and labels use ink.');
assert.match(css, /:focus-visible\{outline:3px solid var\(--coral-action\);outline-offset:5px\}/, 'Keyboard focus remains clearly visible.');

console.log('Visual contract checks passed. Browser rendering remains the final layout gate.');
