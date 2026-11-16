// End-to-end checks of the API. Starts the real server on a spare port.
//   npm test                              -> file storage (throwaway file)
//   DATABASE_URL=postgres://... npm test  -> that Postgres database (use an empty test database)

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 4100 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = 'correct-horse-battery-729';
const tmpFile = path.join(os.tmpdir(), `icaro-test-${process.pid}.json`);
let server;
let visitor = 0;

// each call pretends to be a different visitor unless an ip is given
function call(method, url, { body, key, ip } = {}) {
  const headers = { 'Content-Type': 'application/json', 'True-Client-IP': ip || `10.1.${Math.floor(visitor / 250)}.${(visitor++ % 250) + 1}` };
  if (key) headers['x-admin-key'] = key;
  return fetch(BASE + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    .then(async r => ({ status: r.status, data: await r.json().catch(() => null) }));
}

function startServer(env) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT), RENDER: '1', DB_FILE: tmpFile, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return new Promise((resolve, reject) => {
    let out = '';
    const onData = (d) => { out += d; if (out.includes('Storage:')) resolve(child); };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => reject(new Error('server exited early (' + code + '): ' + out)));
    setTimeout(() => reject(new Error("server did not start: " + out)), 15000).unref();
  });
}

function puneDate(offsetDays) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
const good = () => ({ name: 'Asha Kulkarni', phone: '98765 43210', date: puneDate(3), time: '10:30', guests: 4, note: 'Window seat' });

before(async () => { server = await startServer({ ADMIN_PASSWORD: PASSWORD, OWNER_WHATSAPP: '91 78878 36666' }); });
after(() => { if (server) server.kill(); fs.rmSync(tmpFile, { force: true }); });

test('public pages and data load', async () => {
  const health = await call('GET', '/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.data.storage, process.env.DATABASE_URL ? 'postgres' : 'file');
  const menu = await call('GET', '/api/menu');
  assert.equal(menu.status, 200);
  assert.ok(menu.data.length >= 60, 'menu is seeded');
  assert.equal(typeof menu.data[0].price, 'number');
  const special = await call('GET', '/api/special');
  assert.ok(special.data.name);
  const page = await fetch(BASE + '/');
  assert.equal(page.status, 200);
});

test('admin routes refuse a missing or wrong password', async () => {
  assert.equal((await call('GET', '/api/bookings')).status, 401);
  assert.equal((await call('GET', '/api/bookings', { key: 'changeme729' })).status, 401);
  assert.equal((await call('PUT', '/api/special', { key: 'nope', body: { name: 'x' } })).status, 401);
  assert.equal((await call('DELETE', '/api/menu/1', { key: '' })).status, 401);
  assert.equal((await call('GET', '/api/admin/check', { key: PASSWORD })).status, 200);
});

test('ten wrong passwords lock that visitor out, and nobody else', async () => {
  const ip = '10.9.9.9';
  for (let i = 0; i < 10; i++) assert.equal((await call('GET', '/api/admin/check', { key: 'guess' + i, ip })).status, 401);
  const locked = await call('GET', '/api/admin/check', { key: 'guess-again', ip });
  assert.equal(locked.status, 429);
  assert.match(locked.data.error, /15 minutes/);
  assert.equal((await call('GET', '/api/admin/check', { key: PASSWORD, ip })).status, 429, 'locked even with the right password');
  assert.equal((await call('GET', '/api/admin/check', { key: PASSWORD })).status, 200, 'other visitors are unaffected');
});

test('correct logins never count towards the lockout', async () => {
  const ip = '10.9.9.10';
  for (let i = 0; i < 25; i++) assert.equal((await call('GET', '/api/admin/check', { key: PASSWORD, ip })).status, 200);
});

test('a valid booking is saved, cleaned up and gets a WhatsApp link', async () => {
  const r = await call('POST', '/api/bookings', { body: { ...good(), name: '  Asha   Kulkarni ', phone: '+91 98765-43210' } });
  assert.equal(r.status, 201);
  assert.equal(r.data.booking.name, 'Asha Kulkarni');
  assert.equal(r.data.booking.phone, '9876543210');
  assert.equal(r.data.booking.status, 'new');
  assert.match(r.data.whatsappLink, /^https:\/\/wa\.me\/917887836666\?text=/);
  const list = await call('GET', '/api/bookings', { key: PASSWORD });
  assert.ok(list.data.some(b => b.id === r.data.booking.id));
});

test('bad bookings are refused with a clear reason', async () => {
  const cases = [
    [{ name: '' }, /name/i],
    [{ name: '12345' }, /name/i],
    [{ phone: '12345' }, /mobile number/i],
    [{ phone: '1234567890' }, /mobile number/i],
    [{ phone: '9999999999' }, /mobile number/i],
    [{ phone: 'call me' }, /mobile number/i],
    [{ date: puneDate(-1) }, /passed/i],
    [{ date: '2026-02-31' }, /date/i],
    [{ date: 'tomorrow' }, /date/i],
    [{ date: puneDate(90) }, /60 days/i],
    [{ time: '08:00' }, /9 AM to 7:30 PM/],
    [{ time: '21:15' }, /9 AM to 7:30 PM/],
    [{ time: '25:00' }, /time/i],
    [{ guests: 0 }, /guests/i],
    [{ guests: 2.5 }, /guests/i],
    [{ guests: 500 }, /more than 20/i],
    [{ note: 'x'.repeat(201) }, /200 characters/i]
  ];
  for (const [change, pattern] of cases) {
    const r = await call('POST', '/api/bookings', { body: { ...good(), ...change } });
    assert.equal(r.status, 400, JSON.stringify(change));
    assert.match(r.data.error, pattern, JSON.stringify(change));
  }
  assert.equal((await call('POST', '/api/bookings', {})).status, 400);
});

test('international numbers are accepted with a country code', async () => {
  const r = await call('POST', '/api/bookings', { body: { ...good(), phone: '+44 7911 123456' } });
  assert.equal(r.status, 201);
  assert.equal(r.data.booking.phone, '+447911123456');
});

test('the hidden spam field gets a fake success and saves nothing', async () => {
  const before = (await call('GET', '/api/bookings', { key: PASSWORD })).data.length;
  const r = await call('POST', '/api/bookings', { body: { ...good(), website: 'http://spam.example' } });
  assert.equal(r.status, 201);
  assert.equal(r.data.booking, null);
  assert.equal((await call('GET', '/api/bookings', { key: PASSWORD })).data.length, before);
});

test('one visitor can send 8 booking requests in 10 minutes, then is paused', async () => {
  const ip = '10.8.8.8';
  for (let i = 0; i < 8; i++) assert.equal((await call('POST', '/api/bookings', { body: { ...good(), time: `11:${10 + i}` }, ip })).status, 201);
  assert.equal((await call('POST', '/api/bookings', { body: good(), ip })).status, 429);
  assert.equal((await call('POST', '/api/bookings', { body: good() })).status, 201, 'other visitors are unaffected');
});

test('booking status can only be new, confirmed or cancelled', async () => {
  const made = await call('POST', '/api/bookings', { body: good() });
  const id = made.data.booking.id;
  assert.equal((await call('PUT', '/api/bookings/' + id, { key: PASSWORD, body: { status: 'hacked' } })).status, 400);
  const ok = await call('PUT', '/api/bookings/' + id, { key: PASSWORD, body: { status: 'confirmed' } });
  assert.equal(ok.data.status, 'confirmed');
  assert.equal((await call('DELETE', '/api/bookings/' + id, { key: PASSWORD })).status, 200);
  assert.equal((await call('DELETE', '/api/bookings/' + id, { key: PASSWORD })).status, 404);
  assert.equal((await call('PUT', '/api/bookings/abc', { key: PASSWORD, body: { status: 'new' } })).status, 404);
});

test('menu and special edits are checked and saved', async () => {
  const added = await call('POST', '/api/menu', { key: PASSWORD, body: { category: 'Test', name: 'Test Toast', price: '120' } });
  assert.equal(added.status, 201);
  assert.equal(added.data.price, 120);
  assert.equal(added.data.available, true);
  const id = added.data.id;
  assert.equal((await call('POST', '/api/menu', { key: PASSWORD, body: { category: 'Test', name: 'Bad', price: 'abc' } })).status, 400);
  assert.equal((await call('PUT', '/api/menu/' + id, { key: PASSWORD, body: { price: -5 } })).status, 400);
  assert.equal((await call('PUT', '/api/menu/' + id, { key: PASSWORD, body: { available: 'no' } })).status, 400);
  const edited = await call('PUT', '/api/menu/' + id, { key: PASSWORD, body: { price: null, available: false } });
  assert.equal(edited.data.price, null);
  assert.equal(edited.data.available, false);
  assert.ok((await call('GET', '/api/menu')).data.some(m => m.id === id && m.available === false));
  assert.equal((await call('DELETE', '/api/menu/' + id, { key: PASSWORD })).status, 200);
  assert.equal((await call('PUT', '/api/menu/' + id, { key: PASSWORD, body: { price: 1 } })).status, 404);

  const original = (await call('GET', '/api/special')).data;
  assert.equal((await call('PUT', '/api/special', { key: PASSWORD, body: { name: '   ' } })).status, 400);
  const saved = await call('PUT', '/api/special', { key: PASSWORD, body: { name: ' Wild Mushroom Toast \n\n Masala Omelette ', note: ' ₹340 ' } });
  assert.deepEqual(saved.data, { name: 'Wild Mushroom Toast\nMasala Omelette', note: '₹340' });
  assert.deepEqual((await call('GET', '/api/special')).data, saved.data);
  await call('PUT', '/api/special', { key: PASSWORD, body: original });
});

test('oversized and unreadable requests are refused cleanly', async () => {
  assert.equal((await call('POST', '/api/bookings', { body: { ...good(), note: 'x'.repeat(50000) } })).status, 413);
  const raw = await fetch(BASE + '/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'True-Client-IP': '10.7.7.7' }, body: '{not json' });
  assert.equal(raw.status, 400);
  assert.equal((await call('GET', '/api/nothing-here')).status, 404);
});
