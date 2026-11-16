// With no password (or one of the example passwords) the site runs but admin is off.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function withServer(env, fn) {
  const port = 4700 + Math.floor(Math.random() * 200);
  const tmpFile = path.join(os.tmpdir(), `icaro-off-${process.pid}-${port}.json`);
  const cleanEnv = { ...process.env };
  delete cleanEnv.ADMIN_PASSWORD;
  delete cleanEnv.DATABASE_URL; // this check does not need the database
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...cleanEnv, PORT: String(port), DB_FILE: tmpFile, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  await new Promise((resolve, reject) => {
    const onData = (d) => { out += d; if (out.includes('Storage:')) resolve(); };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    setTimeout(() => reject(new Error("server did not start: " + out)), 15000).unref();
  });
  await new Promise(r => setTimeout(r, 200));
  try { await fn(`http://127.0.0.1:${port}`, () => out); }
  finally { child.kill(); fs.rmSync(tmpFile, { force: true }); }
}

for (const [label, env, attempt] of [
  ['no password set', {}, 'changeme729'],
  ['old default password', { ADMIN_PASSWORD: 'changeme729' }, 'changeme729'],
  ['example password', { ADMIN_PASSWORD: 'yourpassword' }, 'yourpassword']
]) {
  test(`admin is off with ${label}`, async () => {
    await withServer(env, async (base, logs) => {
      const r = await fetch(base + '/api/bookings', { headers: { 'x-admin-key': attempt } });
      assert.equal(r.status, 503);
      assert.equal((await fetch(base + '/api/admin/check', { headers: { 'x-admin-key': '' } })).status, 503);
      assert.equal((await fetch(base + '/api/menu')).status, 200, 'public site still works');
      assert.match(logs(), /Admin is switched off/);
    });
  });
}
