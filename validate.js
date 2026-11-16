// Input checks for everything the API accepts. Each function returns
// { value } with cleaned data, or { error } with a message a visitor can act on.

const TIME_ZONE = 'Asia/Kolkata';
const FIRST_SLOT = '09:00';      // opening time
const LAST_SLOT = '19:30';       // last table, 30 minutes before the 8 PM close
const MAX_DAYS_AHEAD = 60;
const MAX_GUESTS = 20;
const BOOKING_STATUSES = ['new', 'confirmed', 'cancelled'];

// trims, drops control characters, collapses runs of spaces
function cleanText(value, { multiline = false } = {}) {
  if (value === undefined || value === null) return '';
  let s = String(value).replace(/\r\n?/g, '\n');
  s = multiline ? s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '') : s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  if (multiline) return s.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  return s.replace(/\s+/g, ' ').trim();
}

function puneNow(now = new Date()) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now); // YYYY-MM-DD
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  return { date, time };
}

function addDays(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isRealDate(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const d = new Date(isoDate + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === isoDate;
}

// Indian mobiles are stored as 10 digits; other countries keep their +code.
function normalizePhone(raw) {
  const s = String(raw === undefined || raw === null ? '' : raw).trim();
  if (!/^[+\d][\d\s\-().]*$/.test(s)) return null;
  const digits = s.replace(/\D/g, '');
  if (s.startsWith('+')) {
    if (digits.startsWith('91')) return /^91[6-9]\d{9}$/.test(digits) ? digits.slice(2) : null;
    return digits.length >= 8 && digits.length <= 15 ? '+' + digits : null;
  }
  let d = digits.replace(/^0+/, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (!/^[6-9]\d{9}$/.test(d)) return null;
  if (/^(\d)\1{9}$/.test(d)) return null; // 9999999999 and friends
  return d;
}

function validateBooking(body, now = new Date()) {
  const b = body || {};

  const name = cleanText(b.name);
  if (name.length < 2 || name.length > 60 || !/\p{L}/u.test(name)) return { error: 'Enter your name.' };

  const phone = normalizePhone(b.phone);
  if (!phone) return { error: 'Enter a 10-digit mobile number. For a number outside India, start with + and the country code.' };

  const date = cleanText(b.date);
  if (!isRealDate(date)) return { error: 'Choose a date.' };
  const today = puneNow(now);
  if (date < today.date) return { error: 'That date has passed. Choose today or a later date.' };
  if (date > addDays(today.date, MAX_DAYS_AHEAD)) return { error: `Bookings open ${MAX_DAYS_AHEAD} days ahead. Choose an earlier date.` };

  const time = cleanText(b.time).slice(0, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: 'Choose a time.' };
  if (time < FIRST_SLOT || time > LAST_SLOT) return { error: 'We take tables from 9 AM to 7:30 PM. Choose a time in that range.' };
  if (date === today.date && time <= today.time) return { error: 'That time has passed. Choose a later time.' };

  const guests = Number(b.guests);
  if (!Number.isInteger(guests) || guests < 1) return { error: 'Enter the number of guests.' };
  if (guests > MAX_GUESTS) return { error: `For more than ${MAX_GUESTS} guests, call us or message us on WhatsApp.` };

  const note = cleanText(b.note);
  if (note.length > 200) return { error: 'Keep the note under 200 characters.' };

  return { value: { name, phone, date, time, guests, note } };
}

function validateSpecial(body) {
  const b = body || {};
  const name = cleanText(b.name, { multiline: true });
  if (!name) return { error: "Enter today's special." };
  if (name.length > 220) return { error: 'Keep the specials under 220 characters.' };
  const note = cleanText(b.note);
  if (note.length > 80) return { error: 'Keep the note under 80 characters.' };
  return { value: { name, note } };
}

// price: empty means "price on request"
function parsePrice(raw) {
  if (raw === '' || raw === null || raw === undefined) return { value: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100000) return { error: 'Enter the price as a number, or leave it empty.' };
  return { value: Math.round(n * 100) / 100 };
}

// partial = true for edits, where only the fields sent are checked
function validateMenuItem(body, { partial = false } = {}) {
  const b = body || {};
  const out = {};

  if (!partial || b.category !== undefined) {
    const category = cleanText(b.category);
    if (!category || category.length > 60) return { error: 'Enter a category (up to 60 characters).' };
    out.category = category;
  }
  if (!partial || b.name !== undefined) {
    const name = cleanText(b.name);
    if (!name || name.length > 80) return { error: 'Enter an item name (up to 80 characters).' };
    out.name = name;
  }
  if (!partial || b.note !== undefined) {
    const note = cleanText(b.note);
    if (note.length > 200) return { error: 'Keep the description under 200 characters.' };
    out.note = note;
  }
  if (!partial || b.price !== undefined) {
    const price = parsePrice(b.price);
    if (price.error) return price;
    out.price = price.value;
  }
  if (partial && b.available !== undefined) {
    if (typeof b.available !== 'boolean') return { error: 'available must be true or false.' };
    out.available = b.available;
  }
  return { value: out };
}

function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

module.exports = {
  BOOKING_STATUSES,
  validateBooking,
  validateSpecial,
  validateMenuItem,
  normalizePhone,
  parseId,
  puneNow
};
