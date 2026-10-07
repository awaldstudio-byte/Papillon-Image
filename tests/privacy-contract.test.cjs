'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const siteRoot = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(siteRoot, relative), 'utf8');
const pages = fs.readdirSync(siteRoot).filter(file => file.endsWith('.html'));

test('every public page links the Cookie Notice from its legal footer, not primary navigation', () => {
  assert.ok(pages.includes('cookie-notice.html'));
  assert.ok(pages.length >= 18);
  for (const file of pages) {
    const html = read(file);
    const footer = html.match(/<footer\b[^>]*class="footer"[^>]*>[\s\S]*?<\/footer>/)?.[0] || '';
    const nav = html.match(/<nav\b[^>]*id="primary-nav"[^>]*>[\s\S]*?<\/nav>/)?.[0] || '';
    assert.match(footer, /href="cookie-notice\.html">Cookie Notice<\/a>/, file);
    assert.doesNotMatch(nav, /cookie-notice|privacy-policy|terms-and-conditions/, file);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, file);
  }
  assert.match(read('sitemap.xml'), /<loc>https:\/\/www\.papillon-image\.co\.za\/cookie-notice<\/loc>/);
});

test('privacy notices disclose actual processors and no current optional tracking without a false consent control', () => {
  const policy = read('privacy-policy.html');
  const notice = read('cookie-notice.html');
  for (const html of [policy, notice]) {
    assert.match(html, /https:\/\/vercel\.com\/legal\/privacy-policy/);
    assert.match(html, /https:\/\/purelymail\.com\/privacy/);
    assert.match(html, /outside South Africa/);
    assert.match(html, /browser storage/);
    assert.match(html, /retained in email/);
    assert.doesNotMatch(html, /\b(?:ChatGPT|OpenAI)\b/);
  }
  assert.match(notice, /Last updated: 7 October 2026/);
  assert.match(notice, /does not currently embed optional analytics/);
  assert.match(notice, /does not set cookies or save data in local storage or session storage/);
  const noticeMain = notice.match(/<main\b[^>]*>[\s\S]*?<\/main>/)?.[0] || '';
  assert.doesNotMatch(noticeMain, /<button\b/);
  assert.doesNotMatch(read('assets/js/site.js'), /document\.cookie|cookieStore|localStorage|sessionStorage|gtag\(|fbq\(/);
});

test('contact enquiries never use a personal-data mailto form action and have a CSP-compatible no-script fallback', () => {
  const html = read('contact.html');
  const form = html.match(/<form\b[^>]*data-contact-form[^>]*>/)?.[0] || '';
  assert.match(form, /action="\/api\/contact"/);
  assert.match(form, /method="post"/);
  assert.doesNotMatch(form, /mailto:|enctype="text\/plain"/);
  assert.match(html, /<noscript><link rel="stylesheet" href="assets\/css\/no-script\.css">/);
  assert.match(html, /JavaScript is unavailable, so this form cannot send an enquiry/);
  const noScript = html.match(/<noscript>[\s\S]*?<\/noscript>/)?.[0] || '';
  assert.match(noScript, /href="mailto:helga@papillon-image\.co\.za"/);
  assert.match(noScript, /href="https:\/\/wa\.me\/27827458207"/);
  assert.doesNotMatch(noScript, /<style\b/);
  assert.match(read('assets/css/no-script.css'), /\[data-contact-form\],[\s\S]*\[data-delivery-note\]\{display:none!important\}/);
  assert.match(html, /Your details are used to respond to your enquiry\.[\s\S]*href="privacy-policy\.html"/);
});

test('the confirmed Masterclass threshold is consistent with FAQ wording', () => {
  const faq = read('faq.html');
  assert.match(faq, /groups of 6–9 and 10\+/);
  assert.doesNotMatch(faq, /groups of 6–10 and 10\+/);
});

test('new and existing legal pages retain JSON-LD scripts allowed by the current CSP hash', () => {
  const config = JSON.parse(read('vercel.json'));
  const csp = config.headers.flatMap(rule => rule.headers)
    .find(header => header.key.toLowerCase() === 'content-security-policy')?.value || '';
  for (const file of ['privacy-policy.html', 'cookie-notice.html', 'terms-and-conditions.html']) {
    const scripts = [...read(file).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 1, file);
    const script = scripts[0][1];
    assert.doesNotThrow(() => JSON.parse(script), file);
    const hash = crypto.createHash('sha256').update(script).digest('base64');
    assert.ok(csp.includes(`'sha256-${hash}'`), file);
  }
});
