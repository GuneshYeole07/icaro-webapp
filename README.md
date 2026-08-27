# Icaro X 729 Grams Coffee — Web App (Backend)

This turns the site from a single static HTML file into a real small web
application: a Node.js server + a JSON-file database, an admin dashboard,
and a public website that reads live data from the server instead of each
visitor's own browser.

## What's inside
- `server.js` — the backend (Express). All API routes live here.
- `db.js` — tiny file-based database (`data/db.json`, created automatically).
- `data/menu_seed.json` — the starting menu (auto-loaded the first time the
  server runs, if `data/db.json` doesn't exist yet).
- `public/index.html` — the public website.
- `public/admin.html` — the password-protected admin dashboard.

## Running it on your own laptop (to test)
You need [Node.js](https://nodejs.org) installed (v18 or newer).

```
npm install
ADMIN_PASSWORD=yourpassword npm start
```

Then open:
- Website: http://localhost:3000
- Admin: http://localhost:3000/admin.html (enter the password you set above)

## Deploying so it's live on the internet (free — Render.com)

1. Create a free account at https://render.com
2. Push this folder to a GitHub repository (Render deploys from GitHub).
3. In Render: **New → Web Service** → connect your GitHub repo.
4. Settings:
   - Build command: `npm install`
   - Start command: `npm start`
5. Under **Environment**, add:
   - `ADMIN_PASSWORD` = a strong password only you know
   - `OWNER_WHATSAPP` = your WhatsApp number with country code, no `+` or
     spaces (e.g. `917887836666`)
6. Click **Deploy**. Render gives you a live URL like
   `https://icaro-coffee.onrender.com` — that's your real website.
7. (Optional) Connect your own domain later from Render's settings once you
   buy one.

**Note on the free tier:** Render's free web services "sleep" after a period
of no traffic and take ~30–50 seconds to wake up on the next visit. Fine for
testing; if that's not acceptable once it's your real live site, Render's
cheapest paid tier removes it.

## Editing the menu / chef's special
Go to `/admin.html` on your live site, enter your password, and:
- **Chef's Special** tab — type today's specials, hit Save. Changes appear
  for every visitor immediately (not just your own device).
- **Menu** tab — toggle any item available/sold-out, change its price, add
  a brand new item, or delete one.
- **Bookings** tab — see every table booking that comes in, and mark it
  Confirmed/Cancelled.

## About the booking system
When someone submits the booking form on the site, it's saved to the
database and a ready-made WhatsApp message link is generated for you. This
is **not** the same as WhatsApp's official Business API with OTP
verification (like some big chains use) — that requires a Meta-approved
business account and has its own cost. This simpler version gets you 90% of
the value without that cost or approval wait; it can be upgraded later if
needed.

## Security note
The admin password is a simple shared secret (one password, no separate
logins). That's enough for a single owner. If more staff need their own
logins down the line, that's the next upgrade — just say so.
