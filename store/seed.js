// Starting content for a brand-new database: the menu from data/menu_seed.json
// and a default chef's special.

const fs = require('fs');
const path = require('path');

const SEED_MENU_PATH = path.join(__dirname, '..', 'data', 'menu_seed.json');

function seedMenu() {
  try {
    return JSON.parse(fs.readFileSync(SEED_MENU_PATH, 'utf-8'));
  } catch (e) {
    return [];
  }
}

const DEFAULT_SPECIAL = {
  name: "Ask us what's on the pan today",
  note: '— fresh, and usually gone by noon'
};

module.exports = { seedMenu, DEFAULT_SPECIAL };
