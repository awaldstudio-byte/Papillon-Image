'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../assets/js/site.js'), 'utf8');
const SERVICES = [
  'Not sure yet', 'Colour Analysis', 'Style Analysis', 'Colour & Style Experience',
  'The Wardrobe Edit™', 'Shop Savvy™', 'Let’s Face It™', 'Travel Light™',
  'Colour & Style Masterclass', 'Church Talks & Ladies’ Events'
];
const VALID = {
  name: 'Test & Visitor', email: 'visitor+tag@example.com', phone: '+27 82 123 4567',
  service: 'Colour & Style Experience', message: 'Hello Helga\nCan we discuss colour & style? + more = confidence.', website: ''
};

class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.disabled = false;
    this.focusCount = 0;
    this._text = '';
  }
  get textContent() { return this._text + this.children.map(child => typeof child === 'string' ? child : child.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.children = []; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this._text = ''; this.children = [...children]; }
  focus() { this.focusCount += 1; }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function response(ok, data) { return { ok, json: async () => data }; }

function boot(options = {}) {
  const status = new Element();
  const submit = new Element('button');
  submit.textContent = 'Prepare my enquiry';
  const note = new Element('p');
  const handlers = {};
  const initial = options.values || VALID;
  const elements = {};
  for (const key of Object.keys(VALID)) elements[key] = { value: initial[key] ?? '' };
  elements.service.options = ['', ...SERVICES].map(value => ({ value }));
  const form = {
    elements, resetCount: 0,
    querySelector(selector) { return selector === '.form-status' ? status : selector === '[data-submit]' ? submit : null; },
    addEventListener(event, handler) { handlers[event] = handler; },
    reset() { this.resetCount += 1; for (const element of Object.values(elements)) element.value = ''; }
  };
  const location = { search: options.search || '', href: 'https://www.papillon-image.co.za/contact' };
  const calls = [];
  const timers = new Map();
  let timerId = 0;
  const document = {
    body: {},
    querySelector(selector) {
      return selector === '[data-contact-form]' ? form : selector === '[data-delivery-note]' ? note : null;
    },
    getElementById() { return null; },
    querySelectorAll() { return []; },
    createElement(tag) { return new Element(tag); },
    createTextNode(value) { const element = new Element('#text'); element.textContent = value; return element; }
  };
  class FormData {
    constructor(currentForm) { this.values = Object.fromEntries(Object.entries(currentForm.elements).map(([key, value]) => [key, value.value])); }
    get(key) { return this.values[key] ?? null; }
    [Symbol.iterator]() { return Object.entries(this.values)[Symbol.iterator](); }
  }
  const context = vm.createContext({
    document, window: { location }, URLSearchParams, AbortController, FormData,
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch(url, config) {
      calls.push({ url, config });
      if (config?.method === 'POST') return options.post ? options.post(url, config) : Promise.resolve(response(true, { ok: true }));
      return options.availability ? options.availability(url, config) : Promise.resolve(response(true, { configured: options.configured === true }));
    }
  });
  vm.runInContext(source, context, { filename: 'site.js' });
  return {
    status, submit, note, form, elements, location, calls, timers,
    async send() { let prevented = false; await handlers.submit({ preventDefault() { prevented = true; } }); assert.equal(prevented, true); },
    triggerTimeout(delay) {
      const timer = [...timers.values()].find(value => value.delay === delay);
      assert.ok(timer, `Expected a ${delay} ms timeout`);
      timer.callback();
    }
  };
}

function assertError(ui) {
  assert.equal(ui.status.dataset.state, 'error');
  assert.equal(ui.status.children[0].textContent, 'Oops — your message didn’t go through.');
  assert.equal(ui.status.children[1].textContent, 'Please try again, or if you’re still having trouble, you’re welcome to contact me directly via WhatsApp or email.');
  const links = ui.status.children[2].children.filter(child => child.tagName === 'A');
  assert.deepEqual(links.map(link => [link.textContent, link.href]), [
    ['WhatsApp Helga', 'https://wa.me/27827458207'], ['Email Helga', 'mailto:helga@papillon-image.co.za']
  ]);
  assert.equal(ui.form.resetCount, 0);
  assert.equal(ui.elements.message.value, VALID.message);
  assert.equal(ui.submit.disabled, false);
  assert.equal(ui.status.focusCount, 1);
}

test('unconfigured delivery prepares a correctly encoded mailto enquiry without claiming it was sent', async () => {
  const ui = boot({ configured: false });
  await ui.send();
  assert.equal(ui.calls.length, 1);
  assert.equal(ui.calls[0].url, '/api/contact');
  assert.equal(ui.calls[0].config.cache, 'no-store');
  assert.equal(ui.calls[0].config.headers.Accept, 'application/json');
  const mailto = new URL(ui.location.href);
  assert.equal(mailto.protocol, 'mailto:');
  assert.equal(mailto.pathname, 'helga@papillon-image.co.za');
  assert.equal(mailto.searchParams.get('subject'), `Papillon Image enquiry from ${VALID.name}`);
  assert.equal(mailto.searchParams.get('body'), [
    `Name: ${VALID.name}`, `Email: ${VALID.email}`, `Phone: ${VALID.phone}`,
    `Interested in: ${VALID.service}`, '', VALID.message
  ].join('\n'));
  assert.ok(ui.location.href.includes('%26'));
  assert.ok(ui.location.href.includes('%2B'));
  assert.equal(ui.status.dataset.state, 'prepared');
  assert.equal(ui.status.textContent, 'Your enquiry is ready in your email app. Please review it and press Send there. It has not been sent by this website.');
  assert.equal(ui.form.resetCount, 0);
  assert.equal(ui.submit.disabled, false);
  assert.equal(ui.timers.size, 0);
});

test('configuration GET followed by successful POST displays exact approved success copy and resets', async () => {
  const ui = boot({ configured: true });
  await ui.send();
  assert.equal(ui.calls.length, 2);
  assert.equal(ui.calls[1].url, '/api/contact');
  assert.equal(ui.calls[1].config.method, 'POST');
  assert.equal(ui.calls[1].config.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(ui.calls[1].config.body), VALID);
  assert.equal(ui.submit.textContent, 'Let’s start the conversation');
  assert.equal(ui.note.textContent, 'Your enquiry will be sent directly to Helga.');
  assert.equal(ui.status.dataset.state, 'success');
  assert.equal(ui.status.children[0].textContent, 'Thank you for getting in touch.');
  assert.equal(ui.status.children[1].textContent, 'Your message has been sent successfully. I’ll get back to you as soon as I can.');
  assert.equal(ui.status.children[2].textContent, 'With you, in style,Helga');
  assert.equal(ui.status.children[2].children[1].tagName, 'BR');
  assert.equal(ui.form.resetCount, 1);
  assert.equal(ui.elements.message.value, '');
  assert.equal(ui.status.focusCount, 1);
  assert.equal(ui.submit.disabled, false);
  assert.equal(ui.timers.size, 0);
  assert.equal(ui.location.href, 'https://www.papillon-image.co.za/contact');
});

test('HTTP failures, false success flags, malformed responses and network failures display error without reset', async () => {
  const cases = [
    () => Promise.resolve(response(false, { ok: false, error: 'Private provider details must not appear.' })),
    () => Promise.resolve(response(true, { ok: false })),
    () => Promise.resolve(response(true, { ok: 'true' })),
    () => Promise.resolve({ ok: true, json: async () => { throw new Error('Not JSON'); } }),
    () => Promise.reject(new Error('Network unavailable'))
  ];
  for (const post of cases) {
    const ui = boot({ configured: true, post });
    await ui.send();
    assertError(ui);
    assert.equal(ui.calls.length, 2);
    assert.equal(ui.timers.size, 0);
    assert.ok(!ui.status.textContent.includes('Private provider details'));
    assert.equal(ui.location.href, 'https://www.papillon-image.co.za/contact');
  }
});

test('honeypot prevents both direct POST and mailto fallback without clearing visitor fields', async () => {
  for (const configured of [false, true]) {
    const ui = boot({ configured, values: { ...VALID, website: 'https://spam.example' } });
    await ui.send();
    assertError(ui);
    assert.equal(ui.calls.length, 1);
    assert.equal(ui.location.href, 'https://www.papillon-image.co.za/contact');
    assert.equal(ui.timers.size, 0);
  }
});

test('exact approved query service values preselect while unapproved variants do not', async () => {
  for (const service of SERVICES.filter(value => value !== 'Not sure yet')) {
    const ui = boot({ values: { ...VALID, service: '' }, search: `?service=${encodeURIComponent(service)}` });
    assert.equal(ui.elements.service.value, service);
    await ui.send();
    assert.equal(new URL(ui.location.href).searchParams.get('body').includes(`Interested in: ${service}`), true);
  }
  for (const service of ['colour analysis', 'Colour Analysis<script>', 'Unknown service']) {
    const ui = boot({ values: { ...VALID, service: '' }, search: `?service=${encodeURIComponent(service)}` });
    assert.equal(ui.elements.service.value, '');
    await ui.send();
  }
});

test('availability network failure falls back safely instead of leaving the submit button disabled', async () => {
  const ui = boot({ availability: () => Promise.reject(new Error('Unavailable')) });
  await ui.send();
  assert.equal(ui.calls.length, 1);
  assert.equal(ui.status.dataset.state, 'prepared');
  assert.ok(ui.status.textContent.includes('It has not been sent by this website.'));
  assert.equal(ui.submit.disabled, false);
  assert.equal(ui.form.resetCount, 0);
  assert.equal(ui.timers.size, 0);
});

test('a sending timeout displays error and re-enables submission without resetting the form', async () => {
  const ui = boot({ configured: true, post: (url, config) => new Promise((resolve, reject) => {
    config.signal.addEventListener('abort', () => reject(new Error('Timed out')), { once: true });
  }) });
  const sending = ui.send();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.submit.disabled, true);
  assert.equal(ui.status.dataset.state, 'pending');
  ui.triggerTimeout(20000);
  await sending;
  assertError(ui);
  assert.equal(ui.timers.size, 0);
});

test('double clicks during an active POST cause only one POST', async () => {
  const mail = deferred();
  const ui = boot({ configured: true, post: () => mail.promise });
  const first = ui.send();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.submit.disabled, true);
  await ui.send();
  assert.equal(ui.calls.filter(call => call.config?.method === 'POST').length, 1);
  mail.resolve(response(true, { ok: true }));
  await first;
  assert.equal(ui.form.resetCount, 1);
  assert.equal(ui.submit.disabled, false);
});

test('double clicks while the availability GET is pending also cause only one POST', async () => {
  const availability = deferred();
  const mail = deferred();
  const ui = boot({ availability: () => availability.promise, post: () => mail.promise });
  const first = ui.send();
  const second = ui.send();
  availability.resolve(response(true, { configured: true }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.calls.filter(call => call.config?.method === 'POST').length, 1);
  mail.resolve(response(true, { ok: true }));
  await Promise.all([first, second]);
  assert.equal(ui.form.resetCount, 1);
  assert.equal(ui.submit.disabled, false);
});
