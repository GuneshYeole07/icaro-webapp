// File storage: one JSON file on disk (data/db.json).
// Good for running on your own laptop. On most free hosts the disk is wiped on
// every redeploy or restart, so use the Postgres store there (set DATABASE_URL).

const fs = require('fs');
const path = require('path');
const { seedMenu, DEFAULT_SPECIAL } = require('./seed');

// DB_FILE lets tests point at a throwaway file
const DB_PATH = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json');

function defaultData() {
  return { special: { ...DEFAULT_SPECIAL }, menu: seedMenu(), bookings: [] };
}

function save(data) {
  // write to a temp file first so a crash mid-write can't leave a half-written file
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, DB_PATH);
}

function load() {
  if (!fs.existsSync(DB_PATH)) {
    const data = defaultData();
    save(data);
    return data;
  }
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    if (!data.special) data.special = { ...DEFAULT_SPECIAL };
    if (!Array.isArray(data.menu)) data.menu = [];
    if (!Array.isArray(data.bookings)) data.bookings = [];
    return data;
  } catch (e) {
    // unreadable file: keep a copy for recovery, then start again from the seed
    try { fs.copyFileSync(DB_PATH, DB_PATH + '.corrupt-' + Date.now()); } catch (copyErr) { /* nothing to keep */ }
    const data = defaultData();
    save(data);
    return data;
  }
}

function nextId(rows) {
  return rows.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;
}

module.exports = {
  kind: 'file',

  async init() { load(); },

  async getSpecial() { return load().special; },

  async setSpecial(special) {
    const data = load();
    data.special = { name: special.name, note: special.note };
    save(data);
    return data.special;
  },

  async listMenu() { return load().menu; },

  async addMenuItem(item) {
    const data = load();
    const row = { id: nextId(data.menu), ...item, available: true };
    data.menu.push(row);
    save(data);
    return row;
  },

  async updateMenuItem(id, patch) {
    const data = load();
    const row = data.menu.find(m => m.id === id);
    if (!row) return null;
    Object.assign(row, patch);
    save(data);
    return row;
  },

  async deleteMenuItem(id) {
    const data = load();
    const before = data.menu.length;
    data.menu = data.menu.filter(m => m.id !== id);
    if (data.menu.length === before) return false;
    save(data);
    return true;
  },

  async addBooking(booking) {
    const data = load();
    const row = { id: nextId(data.bookings), ...booking, status: 'new', createdAt: new Date().toISOString() };
    data.bookings.push(row);
    save(data);
    return row;
  },

  async listBookings() {
    return [...load().bookings].sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
  },

  async updateBookingStatus(id, status) {
    const data = load();
    const row = data.bookings.find(b => b.id === id);
    if (!row) return null;
    row.status = status;
    save(data);
    return row;
  },

  async deleteBooking(id) {
    const data = load();
    const before = data.bookings.length;
    data.bookings = data.bookings.filter(b => b.id !== id);
    if (data.bookings.length === before) return false;
    save(data);
    return true;
  }
};
