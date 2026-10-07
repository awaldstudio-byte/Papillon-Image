'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const globalHeaders = config.headers.find(rule => rule.source === '/(.*)');
assert.ok(globalHeaders, 'Security headers must cover every route');
const headers = Object.fromEntries(globalHeaders.headers.map(item => [item.key.toLowerCase(), item.value]));
const directives = Object.fromEntries(headers['content-security-policy'].split(';').map(value => {
  const [key, ...sources] = value.trim().split(/\s+/);
  return [key, sources];
}));

test('all-route headers deny framing, referrer disclosure and obsolete XSS filtering', () => {
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.equal(headers['x-frame-options'], 'DENY');
  assert.equal(headers['referrer-policy'], 'no-referrer');
  assert.equal(headers['cross-origin-opener-policy'], 'same-origin');
  assert.equal(headers['x-xss-protection'], '0');
  assert.ok(headers['permissions-policy'].includes('camera=()'));
  assert.ok(headers['permissions-policy'].includes('microphone=()'));
  assert.ok(headers['permissions-policy'].includes('geolocation=()'));
  assert.ok(headers['permissions-policy'].includes('payment=()'));
  assert.equal(headers['set-cookie'], undefined);
  assert.equal(headers['access-control-allow-origin'], undefined);
});

test('HSTS protects website hosts without silently forcing un-audited mail or other subdomains', () => {
  assert.equal(headers['strict-transport-security'], 'max-age=31536000');
  assert.ok(!headers['strict-transport-security'].includes('includeSubDomains'));
  assert.ok(!headers['strict-transport-security'].includes('preload'));
});

test('enforced CSP blocks inline executable script, eval, external connections, frames and plugins', () => {
  assert.deepEqual(directives['default-src'], ["'self'"]);
  assert.ok(directives['script-src'].includes("'self'"));
  assert.ok(!directives['script-src'].includes("'unsafe-inline'"));
  assert.ok(!directives['script-src'].includes("'unsafe-eval'"));
  assert.deepEqual(directives['script-src-attr'], ["'none'"]);
  for (const directive of ['connect-src', 'img-src', 'font-src', 'manifest-src', 'form-action']) {
    assert.deepEqual(directives[directive], ["'self'"]);
  }
  for (const directive of ['object-src', 'frame-src', 'frame-ancestors', 'worker-src', 'media-src', 'base-uri']) {
    assert.deepEqual(directives[directive], ["'none'"]);
  }
  assert.ok(Object.hasOwn(directives, 'upgrade-insecure-requests'));
  assert.deepEqual(directives['style-src-elem'], ["'self'"]);
  // Inline style attributes currently provide part of the existing design.
  // This is an explicit compatibility exception, not permission for inline JS.
  assert.deepEqual(directives['style-src'], ["'self'", "'unsafe-inline'"]);
});

test('every inline structured-data block matches an approved CSP hash and has valid JSON', () => {
  const files = fs.readdirSync(root).filter(file => file.endsWith('.html'));
  assert.ok(files.length >= 17);
  for (const file of files) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(!/\son[a-z]+\s*=/i.test(html), `${file} must not add inline event handlers`);
    assert.ok(!/(?:href|src)\s*=\s*["']\s*javascript:/i.test(html), `${file} must not add JavaScript URLs`);
    for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc=/.test(match[1])) {
        assert.match(match[1], /\bsrc="assets\/js\/site\.js"/);
        assert.equal(match[2], '');
      } else {
        assert.match(match[1], /\btype="application\/ld\+json"/);
        assert.doesNotThrow(() => JSON.parse(match[2]), `${file} JSON-LD must be valid`);
        const hash = "'sha256-" + crypto.createHash('sha256').update(match[2]).digest('base64') + "'";
        assert.ok(directives['script-src'].includes(hash), `${file} JSON-LD changed; update its exact CSP hash before publication`);
      }
    }
    assert.ok(!/<(?:iframe|object|embed|video|audio)\b/i.test(html), `${file} would need an explicit reviewed CSP exception for embeds`);
    assert.ok(!/<(?:img|source|script)[^>]+\bsrc\s*=\s*["'](?:https?:|\/\/|data:)/i.test(html), `${file} must keep loaded assets first-party`);
    assert.ok(!/<style\b/i.test(html), `${file} inline stylesheets are blocked; use the local stylesheet`);
  }
});
