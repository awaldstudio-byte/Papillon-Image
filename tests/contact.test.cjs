'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createHandler } = require('../api/contact.js');

const ENV = { SMTP_USER: 'helga@papillon-image.co.za', SMTP_PASS: 'fake-test-only-not-a-real-password' };
const VALID = {
  name: 'Test Visitor', email: 'visitor@example.com', phone: '+27 82 123 4567',
  service: 'Colour Analysis', message: 'Please tell me more about the colour analysis consultation.', website: ''
};

function harness(options = {}) {
  const messages = [];
  const transports = [];
  let closed = 0;
  const createTransport = config => {
    transports.push(config);
    return {
      sendMail: async message => {
        messages.push(message);
        if (options.send) return options.send(message);
        return { accepted: ['helga@papillon-image.co.za'], rejected: [] };
      },
      close: () => { closed += 1; }
    };
  };
  const handler = createHandler({ env: options.env || ENV, createTransport, now: options.now || (() => 100000) });
  async function call(overrides = {}) {
    const req = {
      method: 'POST',
      headers: { origin: 'https://www.papillon-image.co.za', host: 'www.papillon-image.co.za', 'content-type': 'application/json' },
      body: { ...VALID }, socket: { remoteAddress: '127.0.0.1' }, ...overrides
    };
    const response = { headers: {} };
    const res = {
      setHeader: (key, value) => { response.headers[key] = value; },
      end: value => { response.body = JSON.parse(value); },
      set statusCode(value) { response.status = value; }
    };
    await handler(req, res);
    return response;
  }
  return { call, handler, messages, transports, get closed() { return closed; } };
}

test('GET exposes only configuration presence and never sends mail or leaks secrets', async () => {
  const configured = harness();
  assert.deepEqual((await configured.call({ method: 'GET' })).body, { configured: true });
  const unconfigured = harness({ env: {} });
  assert.deepEqual((await unconfigured.call({ method: 'GET' })).body, { configured: false });
  assert.equal(configured.messages.length, 0);
  for (const env of [{ SMTP_USER: 'invalid', SMTP_PASS: 'secret' }, { ...ENV, SMTP_PASS: '' }, { ...ENV, SMTP_PASS: 'secret\n' }]) {
    assert.deepEqual((await harness({ env }).call({ method: 'GET' })).body, { configured: false });
  }
});

test('unconfigured POST fails closed, and unsupported methods advertise only GET/POST', async () => {
  const unconfigured = harness({ env: {} });
  assert.equal((await unconfigured.call()).status, 503);
  assert.equal(unconfigured.messages.length, 0);
  for (const method of ['PUT', 'DELETE', 'OPTIONS', 'HEAD']) {
    const response = await harness().call({ method });
    assert.equal(response.status, 405);
    assert.equal(response.headers.Allow, 'GET, POST');
  }
});

test('foreign, missing, non-HTTPS and mismatched origins are rejected before SMTP', async () => {
  const forbidden = [
    undefined, '', 'null', 'https://evil.example', 'http://www.papillon-image.co.za',
    'https://www.papillon-image.co.za/', 'https://user@www.papillon-image.co.za',
    'https://papillon-image.co.za', 'https://www.papillon-image.co.za:8443',
    'https://other-project.vercel.app'
  ];
  for (const origin of forbidden) {
    const instance = harness();
    const response = await instance.call({ headers: { origin, host: 'www.papillon-image.co.za', 'content-type': 'application/json' } });
    assert.equal(response.status, 403, String(origin));
    assert.equal(instance.messages.length, 0);
  }
});

test('root and only the exact VERCEL_URL deployment hostname can send from their own origin', async () => {
  for (const host of ['papillon-image.co.za', 'www.papillon-image.co.za', 'papillon-image-test.vercel.app']) {
    const response = await harness({ env: { ...ENV, VERCEL_URL: 'papillon-image-test.vercel.app' } }).call({
      headers: { origin: `https://${host}`, host, 'content-type': 'application/json; charset=utf-8' }
    });
    assert.equal(response.status, 200);
  }
  const bad = await harness({ env: { ...ENV, VERCEL_URL: 'evil.example' } }).call({
    headers: { origin: 'https://evil.example', host: 'evil.example', 'content-type': 'application/json' }
  });
  assert.equal(bad.status, 403);
});

test('SMTP uses fixed recipient, authenticated sender, validated Reply-To, plain text and strict TLS', async () => {
  const instance = harness();
  const response = await instance.call();
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true });
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(response.headers['CDN-Cache-Control'], 'no-store');
  assert.equal(response.headers['Vercel-CDN-Cache-Control'], 'no-store');
  assert.equal(response.headers.Vary, 'Origin, Sec-Fetch-Site');
  assert.equal(response.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(response.headers['Set-Cookie'], undefined);
  assert.equal(response.headers['Access-Control-Allow-Origin'], undefined);
  const config = instance.transports[0];
  assert.equal(config.host, 'smtp.purelymail.com');
  assert.equal(config.port, 465);
  assert.equal(config.secure, true);
  assert.deepEqual(config.auth, { user: ENV.SMTP_USER, pass: ENV.SMTP_PASS });
  assert.equal(config.tls.rejectUnauthorized, true);
  assert.equal(config.tls.minVersion, 'TLSv1.2');
  assert.equal(config.connectionTimeout, 5000);
  assert.equal(config.greetingTimeout, 5000);
  assert.equal(config.socketTimeout, 10000);
  assert.equal(config.dnsTimeout, 5000);
  assert.equal(config.disableFileAccess, true);
  assert.equal(config.disableUrlAccess, true);
  assert.equal(config.logger, false);
  assert.equal(config.debug, false);
  assert.equal(config.transactionLog, false);
  assert.equal(config.maxRecipients, 1);
  const message = instance.messages[0];
  assert.equal(message.to, 'helga@papillon-image.co.za');
  assert.equal(message.from.address, ENV.SMTP_USER);
  assert.deepEqual(message.envelope, { from: ENV.SMTP_USER, to: ['helga@papillon-image.co.za'] });
  assert.deepEqual(message.replyTo, { name: VALID.name, address: VALID.email });
  assert.equal(message.subject, 'Papillon Image website enquiry');
  assert.ok(message.text.includes(VALID.message));
  assert.equal(message.html, undefined);
  assert.equal(message.attachments, undefined);
  assert.equal(instance.closed, 1);
});

test('all master-copy service values and an empty Not sure yet choice are accepted', async () => {
  for (const service of [
    '', 'Not sure yet', 'Colour Analysis', 'Style Analysis', 'Colour & Style Experience',
    'The Wardrobe Edit™', 'Shop Savvy™', 'Let’s Face It™', 'Travel Light™',
    'Colour & Style Masterclass', 'Church Talks & Ladies’ Events'
  ]) {
    assert.equal((await harness().call({ body: { ...VALID, service } })).status, 200, service);
  }
  assert.equal((await harness().call({ body: { name: VALID.name, email: VALID.email, message: VALID.message } })).status, 200);
});

test('invalid, oversized, injected, unknown and honeypot fields never send mail', async () => {
  const bodies = [
    { ...VALID, name: '' }, { ...VALID, name: 'a'.repeat(101) }, { ...VALID, name: 'Visitor\r\nBcc: attacker@example.com' },
    { ...VALID, email: 'visitor@example.com\nBcc: attacker@example.com' }, { ...VALID, email: 'Visitor <visitor@example.com>' },
    { ...VALID, email: 'bad..dots@example.com' }, { ...VALID, email: 'visitor@localhost' },
    { ...VALID, message: '' }, { ...VALID, message: 'a'.repeat(5001) }, { ...VALID, message: { html: 'bad' } },
    { ...VALID, message: 'bad\u0000message' }, { ...VALID, service: 'Anything from a bot' },
    { ...VALID, phone: 'javascript:alert(1)' }, { ...VALID, phone: '1'.repeat(41) },
    { ...VALID, website: 'https://spam.example' }, { ...VALID, to: 'attacker@example.com' },
    { ...VALID, attachments: [] }, [VALID], null
  ];
  for (const body of bodies) {
    const instance = harness();
    const response = await instance.call({ body });
    assert.equal(response.status, 400);
    assert.equal(response.body.ok, false);
    assert.equal(instance.messages.length, 0);
  }
});

test('raw JSON parsing and body/content-type bounds fail safely', async () => {
  const good = await harness().call({ body: JSON.stringify(VALID) });
  assert.equal(good.status, 200);
  for (const body of ['{malformed', Buffer.from('{malformed'), 'x'.repeat(16385), { ...VALID, extra: 'x'.repeat(16385) }]) {
    const instance = harness();
    const response = await instance.call({ body });
    assert.ok([400, 413].includes(response.status));
    assert.equal(instance.messages.length, 0);
  }
  const tooLong = await harness().call({ headers: {
    origin: 'https://www.papillon-image.co.za', host: 'www.papillon-image.co.za',
    'content-type': 'application/json', 'content-length': '16385'
  } });
  assert.equal(tooLong.status, 413);
  for (const type of ['', 'text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data']) {
    assert.equal((await harness().call({ headers: {
      origin: 'https://www.papillon-image.co.za', host: 'www.papillon-image.co.za', 'content-type': type
    } })).status, 415);
  }
});

test('streamed Node requests are parsed within the same body limits', async () => {
  async function run(chunks) {
    const instance = harness();
    const req = Readable.from(chunks);
    req.method = 'POST';
    req.headers = { origin: 'https://www.papillon-image.co.za', host: 'www.papillon-image.co.za', 'content-type': 'application/json' };
    req.socket = { remoteAddress: '127.0.0.1' };
    const result = {};
    const res = { setHeader() {}, end: value => { result.body = JSON.parse(value); }, set statusCode(value) { result.status = value; } };
    await instance.handler(req, res);
    return { result, instance };
  }
  assert.equal((await run([JSON.stringify(VALID)])).result.status, 200);
  const oversize = await run(['x'.repeat(8000), 'x'.repeat(9000)]);
  assert.equal(oversize.result.status, 413);
  assert.equal(oversize.instance.messages.length, 0);
});

test('SMTP failures and absent/rejected acceptance never yield fake success or disclose provider errors', async () => {
  for (const send of [
    async () => { throw new Error(`Private provider error ${ENV.SMTP_PASS}`); },
    async () => ({ accepted: [], rejected: ['helga@papillon-image.co.za'] }),
    async () => ({ accepted: ['someone@example.com'], rejected: [] }),
    async () => ({ accepted: ['helga@papillon-image.co.za'], rejected: ['helga@papillon-image.co.za'] }),
    async () => null
  ]) {
    const instance = harness({ send });
    const response = await instance.call();
    assert.equal(response.status, 502);
    assert.equal(response.body.ok, false);
    assert.ok(!JSON.stringify(response).includes(ENV.SMTP_PASS));
    assert.equal(instance.closed, 1);
  }
});

test('best-effort per-instance burst guard limits attempts and resets after a minute', async () => {
  let time = 100000;
  const instance = harness({ now: () => time });
  for (let index = 0; index < 3; index += 1) assert.equal((await instance.call()).status, 200);
  const blocked = await instance.call();
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers['Retry-After'], '60');
  assert.equal(instance.messages.length, 3);
  time += 60000;
  assert.equal((await instance.call()).status, 200);
});

test('Vercel trusted IPs get independent buckets with an additional instance-wide ceiling', async () => {
  const instance = harness({ env: { ...ENV, VERCEL: '1' } });
  for (let index = 1; index <= 20; index += 1) {
    assert.equal((await instance.call({ headers: {
      origin: 'https://www.papillon-image.co.za', host: 'www.papillon-image.co.za',
      'content-type': 'application/json', 'x-vercel-forwarded-for': `192.0.2.${index}`
    } })).status, 200);
  }
  assert.equal((await instance.call({ headers: {
    origin: 'https://www.papillon-image.co.za', host: 'www.papillon-image.co.za',
    'content-type': 'application/json', 'x-vercel-forwarded-for': '192.0.2.21'
  } })).status, 429);
});

test('spoofed forwarding headers outside Vercel do not bypass the socket-IP bucket', async () => {
  const instance = harness();
  for (let index = 1; index <= 4; index += 1) {
    const result = await instance.call({ headers: {
      origin: 'https://www.papillon-image.co.za', host: 'www.papillon-image.co.za',
      'content-type': 'application/json', 'x-vercel-forwarded-for': `192.0.2.${index}`, 'x-forwarded-for': `192.0.2.${index}`
    } });
    assert.equal(result.status, index === 4 ? 429 : 200);
  }
});

test('Fetch Metadata rejects known cross-origin POST contexts even when Origin is forged', async () => {
  for (const site of ['cross-site', 'same-site', 'none']) {
    const instance = harness();
    const result = await instance.call({ headers: {
      origin: 'https://www.papillon-image.co.za', host: 'www.papillon-image.co.za',
      'content-type': 'application/json', 'sec-fetch-site': site
    } });
    assert.equal(result.status, 403);
    assert.equal(instance.messages.length, 0);
  }
  for (const site of ['same-origin', undefined, 'future-browser-value']) {
    assert.equal((await harness().call({ headers: {
      origin: 'https://www.papillon-image.co.za', host: 'www.papillon-image.co.za',
      'content-type': 'application/json', 'sec-fetch-site': site
    } })).status, 200);
  }
});

test('validation failures consume the same best-effort attempt budget without sending', async () => {
  const instance = harness();
  for (let index = 0; index < 3; index += 1) {
    assert.equal((await instance.call({ body: { ...VALID, website: 'spam' } })).status, 400);
  }
  assert.equal((await instance.call()).status, 429);
  assert.equal(instance.messages.length, 0);
});

test('HTML-looking submitted text stays plain text and never becomes message HTML', async () => {
  const instance = harness();
  const message = '<img src="https://evil.example/tracker" onerror="alert(1)">';
  const result = await instance.call({ body: { ...VALID, message } });
  assert.equal(result.status, 200);
  assert.ok(instance.messages[0].text.endsWith(message));
  assert.equal(instance.messages[0].html, undefined);
  assert.equal(instance.messages[0].attachments, undefined);
});
