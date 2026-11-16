// Postgres storage. Used when DATABASE_URL is set, so bookings and menu edits
// survive redeploys and restarts. Tables are created on first run and the menu
// is filled from data/menu_seed.json once.

const { Pool } = require('pg');
const { seedMenu, DEFAULT_SPECIAL } = require('./seed');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// a dropped idle connection should not crash the server
pool.on('error', (err) => console.error('Database connection error:', err.message));

function menuRow(r) {
  return {
    id: r.id,
    category: r.category,
    name: r.name,
    note: r.note,
    price: r.price === null ? null : Number(r.price),
    available: r.available
  };
}

function bookingRow(r) {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    date: r.date,
    time: r.time,
    guests: r.guests,
    note: r.note,
    status: r.status,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at
  };
}

async function init() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // one server at a time through setup, in case two start together
    await client.query('SELECT pg_advisory_xact_lock(729001)');
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value JSONB NOT NULL
      )`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id        SERIAL PRIMARY KEY,
        category  TEXT NOT NULL,
        name      TEXT NOT NULL,
        note      TEXT NOT NULL DEFAULT '',
        price     NUMERIC(10,2),
        available BOOLEAN NOT NULL DEFAULT TRUE
      )`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        phone      TEXT NOT NULL,
        date       TEXT NOT NULL,
        time       TEXT NOT NULL,
        guests     INTEGER NOT NULL,
        note       TEXT NOT NULL DEFAULT '',
        status     TEXT NOT NULL DEFAULT 'new',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);

    // seed once only: if the owner later deletes every item, it stays deleted
    const seeded = await client.query(`SELECT 1 FROM settings WHERE key = 'seeded'`);
    if (seeded.rowCount === 0) {
      for (const m of seedMenu()) {
        await client.query(
          `INSERT INTO menu_items (id, category, name, note, price, available)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
          [m.id, m.category, m.name, m.note || '', m.price == null ? null : m.price, m.available !== false]
        );
      }
      await client.query(
        `SELECT setval(pg_get_serial_sequence('menu_items', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM menu_items), 1))`
      );
      await client.query(
        `INSERT INTO settings (key, value) VALUES ('special', $1) ON CONFLICT (key) DO NOTHING`,
        [JSON.stringify(DEFAULT_SPECIAL)]
      );
      await client.query(`INSERT INTO settings (key, value) VALUES ('seeded', 'true')`);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  kind: 'postgres',
  init,

  async getSpecial() {
    const r = await pool.query(`SELECT value FROM settings WHERE key = 'special'`);
    return r.rowCount ? r.rows[0].value : { ...DEFAULT_SPECIAL };
  },

  async setSpecial(special) {
    const value = { name: special.name, note: special.note };
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('special', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(value)]
    );
    return value;
  },

  async listMenu() {
    const r = await pool.query('SELECT * FROM menu_items ORDER BY id');
    return r.rows.map(menuRow);
  },

  async addMenuItem(item) {
    const r = await pool.query(
      `INSERT INTO menu_items (category, name, note, price) VALUES ($1, $2, $3, $4) RETURNING *`,
      [item.category, item.name, item.note, item.price]
    );
    return menuRow(r.rows[0]);
  },

  async updateMenuItem(id, patch) {
    const allowed = ['category', 'name', 'note', 'price', 'available'];
    const sets = [];
    const values = [];
    for (const key of allowed) {
      if (patch[key] !== undefined) {
        values.push(patch[key]);
        sets.push(`${key} = $${values.length}`);
      }
    }
    if (!sets.length) {
      const r = await pool.query('SELECT * FROM menu_items WHERE id = $1', [id]);
      return r.rowCount ? menuRow(r.rows[0]) : null;
    }
    values.push(id);
    const r = await pool.query(
      `UPDATE menu_items SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    return r.rowCount ? menuRow(r.rows[0]) : null;
  },

  async deleteMenuItem(id) {
    const r = await pool.query('DELETE FROM menu_items WHERE id = $1', [id]);
    return r.rowCount > 0;
  },

  async addBooking(b) {
    const r = await pool.query(
      `INSERT INTO bookings (name, phone, date, time, guests, note)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [b.name, b.phone, b.date, b.time, b.guests, b.note]
    );
    return bookingRow(r.rows[0]);
  },

  async listBookings() {
    const r = await pool.query('SELECT * FROM bookings ORDER BY date DESC, time DESC, id DESC');
    return r.rows.map(bookingRow);
  },

  async updateBookingStatus(id, status) {
    const r = await pool.query('UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    return r.rowCount ? bookingRow(r.rows[0]) : null;
  },

  async deleteBooking(id) {
    const r = await pool.query('DELETE FROM bookings WHERE id = $1', [id]);
    return r.rowCount > 0;
  }
};
