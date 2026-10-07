'use strict';

const crypto = require('node:crypto');
const net = require('node:net');
const nodemailer = require('nodemailer');

const RECIPIENT = 'helga@papillon-image.co.za';
const MAX_BODY_BYTES = 16 * 1024;
const SERVICES = new Set([
  '', 'Not sure yet', 'Colour Analysis', 'Style Analysis',
  'Colour & Style Experience', 'The Wardrobe Edit™', 'Shop Savvy™',
  'Let’s Face It™', 'Travel Light™', 'Colour & Style Masterclass',
  'Church Talks & Ladies’ Events'
]);
const FIELDS = new Set(['name', 'email', 'phone', 'service', 'message', 'website']);
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const MESSAGE_CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function emailIsValid(value) {
  if (typeof value !== 'string' || value.length > 254 || CONTROL_CHARS.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2 || parts[0].length > 64 || !parts[0] || !parts[1]) return false;
  // Deliberately accept ordinary mailbox addresses only, not display names or headers.
  if (!/^[a-z0-9!#$%&'*+\-/=?^_`{|}~]+(?:\.[a-z0-9!#$%&'*+\-/=?^_`{|}~]+)*$/i.test(parts[0])) return false;
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(parts[1]);
}

function configured(env) {
  return emailIsValid(env.SMTP_USER) && typeof env.SMTP_PASS === 'string' &&
    env.SMTP_PASS.length > 0 && env.SMTP_PASS.length <= 1024 &&
    !/[\u0000\r\n]/.test(env.SMTP_PASS);
}

function header(req, name) {
  const value = req.headers && req.headers[name];
  return typeof value === 'string' ? value : '';
}

function sameOrigin(req, env) {
  const rawOrigin = header(req, 'origin');
  if (!rawOrigin || rawOrigin === 'null') return false;
  // Defence in depth for modern browsers. Older browsers or future unknown
  // metadata values still have to pass the exact Origin/Host check below.
  const fetchSite = header(req, 'sec-fetch-site');
  if (['cross-site', 'same-site', 'none'].includes(fetchSite)) return false;
  const permittedHosts = new Set(['papillon-image.co.za', 'www.papillon-image.co.za']);
  if (typeof env.VERCEL_URL === 'string' && /^[a-z0-9-]+\.vercel\.app$/i.test(env.VERCEL_URL)) {
    permittedHosts.add(env.VERCEL_URL.toLowerCase());
  }
  try {
    const origin = new URL(rawOrigin);
    const requestHost = header(req, 'host').toLowerCase();
    // Browser Origin headers are serialized origins, without a path or credentials.
    return origin.protocol === 'https:' && origin.origin === rawOrigin &&
      permittedHosts.has(origin.hostname) && requestHost === origin.host;
  } catch {
    return false;
  }
}

function reply(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin, Sec-Fetch-Site');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

function requestError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function readBody(req) {
  const type = header(req, 'content-type');
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(type)) {
    throw requestError(415, 'Please submit the enquiry as JSON.');
  }
  const declaredLength = header(req, 'content-length');
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_BODY_BYTES)) {
    throw requestError(413, 'Your enquiry is too long. Please shorten it and try again.');
  }
  let body = req.body;
  if (body === undefined) {
    body = await new Promise((resolve, reject) => {
      const chunks = [];
      let bytes = 0;
      let settled = false;
      const timer = setTimeout(() => finish(requestError(408, 'The request timed out. Please try again.')), 10000);
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        req.removeListener('data', onData);
        req.removeListener('end', onEnd);
        req.removeListener('error', onError);
        req.removeListener('aborted', onAborted);
        if (error) {
          // Drain an oversized request without retaining its contents.
          chunks.length = 0;
          req.once('error', () => {});
          req.resume();
          reject(error);
        } else resolve(value);
      };
      const onData = chunk => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > MAX_BODY_BYTES) {
          finish(requestError(413, 'Your enquiry is too long. Please shorten it and try again.'));
        } else chunks.push(buffer);
      };
      const onEnd = () => finish(null, Buffer.concat(chunks).toString('utf8'));
      const onError = () => finish(requestError(400, 'We could not read your enquiry.'));
      const onAborted = () => finish(requestError(400, 'The request was interrupted.'));
      req.on('data', onData);
      req.on('end', onEnd);
      req.on('error', onError);
      req.on('aborted', onAborted);
    });
  }
  try {
    if (Buffer.isBuffer(body)) body = body.toString('utf8');
    if (typeof body === 'string') {
      if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) throw requestError(413, 'Your enquiry is too long.');
      body = JSON.parse(body);
    } else if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_BODY_BYTES) {
      throw requestError(413, 'Your enquiry is too long.');
    }
  } catch (error) {
    if (error.status === 413) throw error;
    throw requestError(400, 'We could not read your enquiry.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.getPrototypeOf(body) !== Object.prototype || Object.keys(body).some(key => !FIELDS.has(key))) {
    throw requestError(400, 'Please check the enquiry fields and try again.');
  }
  return body;
}

function validate(body) {
  const limits = { name: 100, email: 254, phone: 40, service: 100, message: 5000, website: 100 };
  const values = {};
  for (const [field, limit] of Object.entries(limits)) {
    const value = body[field] === undefined && ['phone', 'service', 'website'].includes(field) ? '' : body[field];
    if (typeof value !== 'string' || value.length > limit ||
        (field === 'message' ? MESSAGE_CONTROL_CHARS : CONTROL_CHARS).test(value)) {
      throw requestError(400, 'Please check the enquiry fields and try again.');
    }
    values[field] = value.trim();
  }
  if (values.website) throw requestError(400, 'We could not accept this enquiry.');
  if (!values.name || !emailIsValid(values.email) || !values.message ||
      !/^[+\d ().-]*$/.test(values.phone) || !SERVICES.has(values.service)) {
    throw requestError(400, 'Please check your name, email, service and message.');
  }
  return values;
}

function createHandler({ env = process.env, createTransport = nodemailer.createTransport, now = Date.now } = {}) {
  const buckets = new Map();
  const salt = crypto.randomBytes(16);
  let globalBucket = { start: 0, count: 0 };
  // This is a small per-instance burst guard, NOT a durable/distributed rate limit.
  // New serverless instances have independent state. Provider/WAF controls are still
  // required if abuse occurs; no persistent IP or enquiry history is retained here.
  function takeAttempt(req) {
    const instant = now();
    for (const [key, bucket] of buckets) if (instant - bucket.start >= 60000) buckets.delete(key);
    if (instant - globalBucket.start >= 60000) globalBucket = { start: instant, count: 0 };
    const trustedForwarded = env.VERCEL === '1' ? header(req, 'x-vercel-forwarded-for').split(',')[0].trim() : '';
    const ip = net.isIP(trustedForwarded) ? trustedForwarded : req.socket && req.socket.remoteAddress;
    const key = crypto.createHmac('sha256', salt).update(typeof ip === 'string' ? ip : 'unknown').digest('hex');
    const bucket = buckets.get(key) || { start: instant, count: 0 };
    if (globalBucket.count >= 20 || bucket.count >= 3 || (!buckets.has(key) && buckets.size >= 512)) return false;
    bucket.count += 1;
    globalBucket.count += 1;
    buckets.set(key, bucket);
    return true;
  }

  return async function contact(req, res) {
    const method = req.method;
    if (method === 'GET') return reply(res, 200, { configured: configured(env) });
    if (method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return reply(res, 405, { ok: false, error: 'This method is not supported.' });
    }
    // This blocks cross-site browser posts, but a non-browser client can forge
    // Origin. It does not replace provider/WAF abuse protections.
    if (!sameOrigin(req, env)) return reply(res, 403, { ok: false, error: 'Please use the enquiry form on the Papillon Image website.' });
    if (!configured(env)) return reply(res, 503, { ok: false, error: 'Online sending is not available yet. Please email Helga directly.' });
    if (!takeAttempt(req)) {
      res.setHeader('Retry-After', '60');
      return reply(res, 429, { ok: false, error: 'Please wait a minute before trying again, or email Helga directly.' });
    }
    let values;
    try {
      values = validate(await readBody(req));
    } catch (error) {
      return reply(res, error.status || 400, { ok: false, error: error.status ? error.message : 'Please check your enquiry and try again.' });
    }
    let transport;
    let deadline;
    try {
      transport = createTransport({
        host: 'smtp.purelymail.com', port: 465, secure: true,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true, servername: 'smtp.purelymail.com' },
        connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000, dnsTimeout: 5000,
        pool: false, logger: false, debug: false, transactionLog: false,
        disableFileAccess: true, disableUrlAccess: true, maxRecipients: 1
      });
      const result = await Promise.race([
        transport.sendMail({
          from: { name: 'Papillon Image website', address: env.SMTP_USER },
          to: RECIPIENT,
          replyTo: { name: values.name, address: values.email },
          envelope: { from: env.SMTP_USER, to: [RECIPIENT] },
          subject: 'Papillon Image website enquiry',
          text: [
            'A new enquiry was submitted on the Papillon Image website.', '',
            `Name: ${values.name}`, `Email: ${values.email}`,
            `Phone / WhatsApp: ${values.phone || 'Not provided'}`,
            `Interested in: ${values.service || 'Not sure yet'}`, '', values.message
          ].join('\n'),
          disableFileAccess: true, disableUrlAccess: true
        }),
        new Promise((resolve, reject) => {
          // Bound the response wait. A network timeout can leave delivery
          // uncertain, so do not retry automatically or claim successful delivery.
          deadline = setTimeout(() => reject(new Error('Delivery timed out')), 15000);
        })
      ]);
      if (!result || !Array.isArray(result.accepted) ||
          !result.accepted.some(address => typeof address === 'string' && address.toLowerCase() === RECIPIENT) ||
          (Array.isArray(result.rejected) && result.rejected.length)) {
        throw new Error('Delivery was not accepted');
      }
      // SMTP acceptance is not a claim that the message reached the inbox.
      return reply(res, 200, { ok: true });
    } catch {
      // Never return or log provider errors, credentials or enquiry contents.
      return reply(res, 502, { ok: false, error: 'We could not send your enquiry. Please email Helga directly or try again later.' });
    } finally {
      clearTimeout(deadline);
      try { if (transport && typeof transport.close === 'function') transport.close(); } catch { /* no sensitive logs */ }
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
