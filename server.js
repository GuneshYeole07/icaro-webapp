const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme729';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- tiny admin-password guard ----------
// Not a real auth system (no sessions, no per-user accounts) — just enough
// to stop a random visitor from editing the menu. Good enough for a single
// owner. If more people need separate logins later, this is the first
// thing to upgrade.
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (key !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Wrong or missing admin password.' });
  }
  next();
}

// ---------- health check (useful for hosting platforms) ----------
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---------- lightweight password check (used by the public site's board editor) ----------
app.get('/api/admin/check', requireAdmin, (req, res) => res.json({ ok: true }));

// ---------- chef's special ----------
app.get('/api/special', (req, res) => {
  const data = db.load();
  res.json(data.special);
});

app.put('/api/special', requireAdmin, (req, res) => {
  const { name, note } = req.body || {};
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name is required' });
  }
  const data = db.load();
  data.special = { name: name.trim(), note: (note || '').trim() };
  db.save(data);
  res.json(data.special);
});

// ---------- menu ----------
app.get('/api/menu', (req, res) => {
  const data = db.load();
  res.json(data.menu);
});

app.post('/api/menu', requireAdmin, (req, res) => {
  const { category, name, price, note } = req.body || {};
  if (!category || !name) {
    return res.status(400).json({ error: 'category and name are required' });
  }
  const data = db.load();
  const nextId = data.menu.reduce((max, m) => Math.max(max, m.id), 0) + 1;
  const item = {
    id: nextId,
    category: String(category).trim(),
    name: String(name).trim(),
    note: (note || '').trim(),
    price: price === '' || price === undefined || price === null ? null : Number(price),
    available: true
  };
  data.menu.push(item);
  db.save(data);
  res.status(201).json(item);
});

app.put('/api/menu/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const data = db.load();
  const item = data.menu.find(m => m.id === id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const { name, category, note, price, available } = req.body || {};
  if (name !== undefined) item.name = String(name).trim();
  if (category !== undefined) item.category = String(category).trim();
  if (note !== undefined) item.note = String(note).trim();
  if (price !== undefined) item.price = price === '' || price === null ? null : Number(price);
  if (available !== undefined) item.available = Boolean(available);

  db.save(data);
  res.json(item);
});

app.delete('/api/menu/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const data = db.load();
  const before = data.menu.length;
  data.menu = data.menu.filter(m => m.id !== id);
  if (data.menu.length === before) return res.status(404).json({ error: 'Item not found' });
  db.save(data);
  res.json({ ok: true });
});

// ---------- bookings ----------
app.post('/api/bookings', (req, res) => {
  const { name, phone, date, time, guests, note } = req.body || {};
  if (!name || !phone || !date || !time || !guests) {
    return res.status(400).json({ error: 'name, phone, date, time and guests are required' });
  }
  const data = db.load();
  const nextId = data.bookings.reduce((max, b) => Math.max(max, b.id), 0) + 1;
  const booking = {
    id: nextId,
    name: String(name).trim(),
    phone: String(phone).trim(),
    date: String(date).trim(),
    time: String(time).trim(),
    guests: Number(guests),
    note: (note || '').trim(),
    status: 'new',
    createdAt: new Date().toISOString()
  };
  data.bookings.push(booking);
  db.save(data);

  // Owner notification: a ready-made WhatsApp click-to-chat link.
  // (A real auto-send needs the paid/approved WhatsApp Business API —
  // this free version just prepares the message; the browser opens it.)
  const ownerPhone = process.env.OWNER_WHATSAPP || '';
  const msg = encodeURIComponent(
    `New table booking:\n${booking.name} (${booking.phone})\n${booking.date} at ${booking.time}, ${booking.guests} guests${booking.note ? `\nNote: ${booking.note}` : ''}`
  );
  const whatsappLink = ownerPhone ? `https://wa.me/${ownerPhone}?text=${msg}` : null;

  res.status(201).json({ booking, whatsappLink });
});

app.get('/api/bookings', requireAdmin, (req, res) => {
  const data = db.load();
  const sorted = [...data.bookings].sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
  res.json(sorted);
});

app.put('/api/bookings/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const data = db.load();
  const booking = data.bookings.find(b => b.id === id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  const { status } = req.body || {};
  if (status !== undefined) booking.status = String(status);
  db.save(data);
  res.json(booking);
});

app.delete('/api/bookings/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const data = db.load();
  const before = data.bookings.length;
  data.bookings = data.bookings.filter(b => b.id !== id);
  if (data.bookings.length === before) return res.status(404).json({ error: 'Booking not found' });
  db.save(data);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Icaro backend running on http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin.html`);
});
