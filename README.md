# Icaro X 729 Grams Coffee — Web App (Backend)

https://icaro-webapp.onrender.com/

A small web application: a Node.js server, a database, an admin dashboard,
and a public website that reads live data from the server.

## What's inside
- `server.js` — the backend (Express). All API routes live here.
- `validate.js` — the checks on everything the API accepts (bookings, menu
  edits, the chef's special).
- `store/` — where data is kept. `postgres.js` is used when `DATABASE_URL` is
  set; otherwise `file.js` keeps everything in `data/db.json`.
- `data/menu_seed.json` — the starting menu, loaded once into a new database.
- `test/` — automated checks of the API. Run them with `npm test`.
- `public/index.html` — the public website (markup only).
- `public/css/site.css` and `public/js/site.js` — its styles and behaviour.
- `public/images/gallery/` — gallery photos (`thumbs/` holds the small
  versions the photo wheel loads first). `public/media/` holds the hero video.
- `public/fonts/` — the typefaces, served from this site.
- `public/images/dishes/` (optional) — add `<dish-name>.jpg` here, e.g.
  `black-chana-hummus.jpg`, and it appears when a visitor taps that dish.
- `public/admin.html` — the password-protected admin dashboard.

## Running it on your own laptop (to test)
You need [Node.js](https://nodejs.org) installed (v18 or newer).

Windows (Command Prompt):
```
npm install
set ADMIN_PASSWORD=pick-your-own-long-password
npm start
```

Mac / Linux:
```
npm install
ADMIN_PASSWORD=pick-your-own-long-password npm start
```

Use a password of your own. The server has no default password, and it refuses
the example ones that have appeared in this README (`yourpassword`,
`changeme729`, `choose-a-strong-password`). Until a real one is set, the public
site works but the admin dashboard stays switched off.

With no `DATABASE_URL`, data is kept in `data/db.json` on your laptop, which is
fine for testing.

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
   - `ADMIN_PASSWORD` = a strong password only you know (10+ characters)
   - `OWNER_WHATSAPP` = your WhatsApp number with country code, no `+` or
     spaces (e.g. `917887836666`)
   - `DATABASE_URL` = your Postgres connection string (see the next section).
     **Without this, bookings and menu edits are erased on every redeploy or
     restart.**
6. Click **Deploy**. Render gives you a live URL like
   `https://icaro-coffee.onrender.com` — that's your real website.
7. (Optional) Connect your own domain later from Render's settings once you
   buy one.

**Note on the free tier:** Render's free web services "sleep" after a period
of no traffic and take ~30–50 seconds to wake up on the next visit. Fine for
testing; if that's not acceptable once it's your real live site, Render's
cheapest paid tier removes it.

## Setting up the database (do this before going live)
Render's free web services don't keep files between deploys, so the site needs
a real database to remember bookings and menu changes.

1. Create a free Postgres database. [Neon](https://neon.tech) works well: its
   free plan doesn't expire. (Render's own free Postgres is deleted 30 days
   after you create it, see https://render.com/docs/free, so only use that one
   if you pay for it.)
2. Copy the database's connection string. It looks like
   `postgresql://user:password@host/dbname?sslmode=require`.
3. In Render, add it to your web service as the `DATABASE_URL` environment
   variable and redeploy.
4. Open `https://your-site/api/health`. It should say `"storage":"postgres"`.

The tables and the starting menu are created automatically on the first run.
Keep the connection string private: anyone who has it can read your bookings.

## Bookings: what the site accepts
- A name, and a real phone number: a 10-digit Indian mobile, or any other
  country's number starting with `+` and the country code.
- A date from today up to 60 days ahead (Pune time).
- A time from 9:00 AM to 7:30 PM, and not in the past for today.
- 1 to 20 guests, and a note of up to 200 characters.
- At most 8 booking requests from one visitor every 10 minutes.

To change the hours, the 60-day window or the guest limit, edit the constants
at the top of `validate.js` (and the matching `min`/`max` on the time field in
`public/index.html`).

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

Ten wrong passwords from one visitor lock admin for that visitor for 15
minutes. If you lock yourself out, wait 15 minutes or restart the service.
