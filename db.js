// Tiny file-based "database". No native modules, no separate DB server —
// just a JSON file on disk. Perfectly fine for a single-cafe site's traffic.
// If Icaro ever needs heavier concurrent writes, swap this for Postgres later
// without changing any of the route code much (same shape of functions).

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');
const SEED_MENU_PATH = path.join(__dirname, 'data', 'menu_seed.json');

function defaultData() {
  let menu = [];
  try {
    menu = JSON.parse(fs.readFileSync(SEED_MENU_PATH, 'utf-8'));
  } catch (e) {
    menu = [];
  }
  return {
    special: {
      name: "Ask us what's on the pan today",
      note: "— fresh, and usually gone by noon"
    },
    menu,
    bookings: []
  };
}

function load() {
  if (!fs.existsSync(DB_PATH)) {
    const data = defaultData();
    save(data);
    return data;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch (e) {
    // corrupted file — rebuild from seed rather than crash the server
    const data = defaultData();
    save(data);
    return data;
  }
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = { load, save };
