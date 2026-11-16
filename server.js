const crypto = require('crypto');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const store = require('./store');
const {
  BOOKING_STATUSES,
  validateBooking,
  validateSpecial,
  validateMenuItem,
  parseId
} = require('./validate');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- admin password ----------
// There is no built-in default. Until ADMIN_PASSWORD is set, the public site
// works but every admin action is refused. The values below appeared in this
// project's public code and docs, so they are refused as well.
const PUBLICLY_KNOWN_PASSWORDS = ['changeme729', 'choose-a-strong-password', 'yourpassword'];
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim();
const ADMIN_READY = ADMIN_PASSWORD.length > 0 && !PUBLICLY_KNOWN_PASSWORDS.includes(ADMIN_PASSWORD);

// compares in constant time, so response timing can't leak the password
function passwordMatches(candidate) {
  if (typeof candidate !== 'string' || !candidate) return false;
  const a = crypto.createHash('sha256').update(candidate).digest();
  const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res, next) {
  if (!ADMIN_READY) {
    return res.status(503).json({ error: 'Admin is switched off until a password is set on the server (ADMIN_PASSWORD).' });
  }
  if (!passwordMatches(req.headers['x-admin-key'])) {
    return res.status(401).json({ error: 'Wrong or missing admin password.' });
  }
  next();
}

// ---------- rate limits ----------
// Limits are counted per visitor address, so the server has to know the real
// one. On Render every request passes through Cloudflare and then Render's own
// proxy, and Cloudflare puts the visitor's address in True-Client-IP, which a
// visitor cannot fake. That header is only believed when running on Render
// (Render sets the RENDER variable itself); anywhere else the direct
// connection address is used. On a different host, check how it passes the
// visitor's address before relying on these limits.
const ON_RENDER = Boolean(process.env.RENDER);
if (ON_RENDER) app.set('trust proxy', 1);
app.disable('x-powered-by');

function visitorKey(req) {
  const fromEdge = ON_RENDER ? (req.headers['true-client-ip'] || req.headers['cf-connecting-ip']) : null;
  const ip = typeof fromEdge === 'string' && fromEdge.trim() ? fromEdge.trim() : (req.ip || 'unknown');
  return ipKeyGenerator(ip);
}

// 10 wrong passwords from one address locks admin for 15 minutes.
// Correct logins are not counted.
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: visitorKey,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode !== 401,
  message: { error: 'Too many wrong passwords. Wait 15 minutes, then try again.' }
});
const admin = [adminLimiter, requireAdmin];

// 8 booking requests from one address every 10 minutes.
const bookingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 8,
  keyGenerator: visitorKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many booking requests from this connection. Wait 10 minutes, or call us.' }
});

app.use(cors());
app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// lets async route handlers report errors to the error handler below
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- health check (useful for hosting platforms) ----------
app.get('/api/health', (req, res) => res.json({ ok: true, storage: store.kind }));

// ---------- password check (used by the public site's board editor) ----------
app.get('/api/admin/check', admin, (req, res) => res.json({ ok: true }));

// ---------- chef's special ----------
app.get('/api/special', wrap(async (req, res) => {
  res.json(await store.getSpecial());
}));

app.put('/api/special', admin, wrap(async (req, res) => {
  const { value, error } = validateSpecial(req.body);
  if (error) return res.status(400).json({ error });
  res.json(await store.setSpecial(value));
}));

// ---------- menu ----------
app.get('/api/menu', wrap(async (req, res) => {
  res.json(await store.listMenu());
}));

app.post('/api/menu', admin, wrap(async (req, res) => {
  const { value, error } = validateMenuItem(req.body);
  if (error) return res.status(400).json({ error });
  res.status(201).json(await store.addMenuItem(value));
}));

app.put('/api/menu/:id', admin, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Item not found' });
  const { value, error } = validateMenuItem(req.body, { partial: true });
  if (error) return res.status(400).json({ error });
  const item = await store.updateMenuItem(id, value);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
}));

app.delete('/api/menu/:id', admin, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id || !(await store.deleteMenuItem(id))) return res.status(404).json({ error: 'Item not found' });
  res.json({ ok: true });
}));

// ---------- bookings ----------
app.post('/api/bookings', bookingLimiter, wrap(async (req, res) => {
  // "website" is a hidden field real visitors never see. Bots fill every field,
  // so a value here means spam: answer as if it worked and save nothing.
  if (req.body && typeof req.body.website === 'string' && req.body.website.trim()) {
    return res.status(201).json({ booking: null, whatsappLink: null });
  }

  const { value, error } = validateBooking(req.body);
  if (error) return res.status(400).json({ error });

  const booking = await store.addBooking(value);

  // Owner notification: a ready-made WhatsApp click-to-chat link.
  // (A real auto-send needs the paid/approved WhatsApp Business API —
  // this free version just prepares the message; the browser opens it.)
  const ownerPhone = (process.env.OWNER_WHATSAPP || '').replace(/\D/g, '');
  const msg = encodeURIComponent(
    `New table booking:\n${booking.name} (${booking.phone})\n${booking.date} at ${booking.time}, ${booking.guests} guests${booking.note ? `\nNote: ${booking.note}` : ''}`
  );
  const whatsappLink = ownerPhone ? `https://wa.me/${ownerPhone}?text=${msg}` : null;

  res.status(201).json({ booking, whatsappLink });
}));

app.get('/api/bookings', admin, wrap(async (req, res) => {
  res.json(await store.listBookings());
}));

app.put('/api/bookings/:id', admin, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Booking not found' });
  const status = req.body ? req.body.status : undefined;
  if (!BOOKING_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${BOOKING_STATUSES.join(', ')}` });
  }
  const booking = await store.updateBookingStatus(id, status);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  res.json(booking);
}));

app.delete('/api/bookings/:id', admin, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id || !(await store.deleteBooking(id))) return res.status(404).json({ error: 'Booking not found' });
  res.json({ ok: true });
}));

// ---------- errors ----------
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'That request is too large.' });
  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    return res.status(400).json({ error: 'The request could not be read.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Try again in a minute.' });
});

// ---------- start ----------
store.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Icaro backend running on http://localhost:${PORT}`);
      console.log(`Admin dashboard: http://localhost:${PORT}/admin.html`);
      console.log(`Storage: ${store.kind === 'postgres' ? 'Postgres database' : 'JSON file (data/db.json)'}`);
      if (!ADMIN_READY) {
        console.warn('WARNING: ADMIN_PASSWORD is missing or is one of the example passwords. Admin is switched off until you set a private one.');
      } else if (ADMIN_PASSWORD.length < 10) {
        console.warn('WARNING: ADMIN_PASSWORD is short. Use at least 10 characters.');
      }
      if (store.kind === 'file' && process.env.RENDER) {
        console.warn('WARNING: no DATABASE_URL set. On Render, bookings and menu edits are erased on every redeploy or restart. See README.');
      }
    });
  })
  .catch((err) => {
    console.error('Could not start: the database is not reachable.', err.message);
    process.exit(1);
  });
