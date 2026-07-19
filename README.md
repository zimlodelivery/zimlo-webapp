# Jimlo — Phase 1 Web App

A real, deployable web app for Jimlo: customer ordering (Food, Grocery, Medicine,
Bakery, Parcel, Custom) + an admin dashboard where your orders actually arrive.

Built with **Next.js + React + Tailwind CSS + Prisma**. Everything here is plain,
readable code you can open and edit yourself — no drag-and-drop builder, no lock-in.

---

## 1. Run it on your own computer first (recommended)

You'll need [Node.js](https://nodejs.org) installed (version 18 or higher).

```bash
# 1. Install dependencies
npm install

# 2. Create your local database (SQLite — no setup needed)
cp .env.example .env
npx prisma db push
npx prisma db seed   # loads your starting food menu + default settings

# 3. Start the app
npm run dev
```

Open **http://localhost:3000** — that's the customer app: two big buttons
("खाना ऑर्डर करें" for the fixed food menu, "आपको क्या चाहिए?" for anything else),
QR-code UPI payment, and order tracking.

Open **http://localhost:3000/admin** — your dashboard, with three tabs:
- **Orders** — new requests, orders awaiting payment verification, active
  deliveries, and delivered history
- **Menu** — add, edit, or delete food items and prices any time, no code needed
- **Settings** — your UPI ID, brand name, and contact number, all editable
Default admin password is `jimlo2026` (set in `.env` — change it before going live).

Place a test order on the customer app, then check it appears instantly on `/admin`.

---

## 2. Going live on a real domain

**No computer? Skip to section 2b below — everything can be done from a phone browser.**

The easiest free path for a Next.js app like this is **Vercel** (made by the
creators of Next.js) + a free **Postgres database** (Neon or Supabase), then
pointing your own domain at it.

### Step A — Push this code to GitHub
1. Create a free account at [github.com](https://github.com) if you don't have one.
2. Create a new repository, e.g. `jimlo-webapp`.
3. Upload this whole folder to it (GitHub's website lets you drag-and-drop files,
   or use `git` from the command line if you're comfortable with it).

### Step B — Get a free production database
Your local SQLite file won't work once deployed (hosting platforms don't keep it
between requests), so switch to a real hosted database — free tier is enough
to start:

1. Go to [neon.tech](https://neon.tech) (or [supabase.com](https://supabase.com)) and create a free project.
2. Copy the **connection string** it gives you (starts with `postgresql://...`).
3. In `prisma/schema.prisma`, change:
   ```prisma
   datasource db {
     provider = "postgresql"   // change from "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
4. Commit and push this change to GitHub.

### Step C — Deploy on Vercel
1. Go to [vercel.com](https://vercel.com), sign up, click **Add New → Project**.
2. Import your `jimlo-webapp` GitHub repo.
3. Under **Environment Variables**, add:
   - `DATABASE_URL` → the Postgres connection string from Step B
   - `ADMIN_PASSWORD` → a password only you know
4. Click **Deploy**. In a couple of minutes you'll get a live URL like
   `jimlo-webapp.vercel.app`.
5. Run the database migration once, from your own computer, pointed at the
   production database:
   ```bash
   # temporarily set DATABASE_URL in your terminal to the production string, then:
   npx prisma db push
   npx prisma db seed
   ```
   (If you don't have a computer, you can also add your menu items and
   settings directly from `/admin` → Menu / Settings tabs after the first
   deploy — the seed step is just a shortcut to start with the menu already
   filled in.)

### Step D — Connect your own domain
1. Buy a domain if you don't have one (GoDaddy, Hostinger, Namecheap — a `.in` or
   `.com` domain costs roughly ₹500–1000/year).
2. In Vercel, go to your project → **Settings → Domains** → add your domain.
3. Vercel will show you 1–2 DNS records to add. Log into wherever you bought the
   domain, find **DNS settings**, and add those records.
4. Within a few hours (often minutes), `jimlo.com` (or whatever you chose) will
   show your live app.

**Cost at this stage:** ₹0/month for hosting (Vercel free tier + Neon free tier)
+ your domain's yearly renewal. This comfortably handles Pilukhedi's order volume
at launch.

---

## 2b. Doing all of the above from just a phone (no computer)

Every step above — uploading code, running `npm install`, deploying — normally
needs a terminal. If you don't have a computer, use a free online code editor
that runs in your phone's browser instead of your phone itself:

1. Go to **replit.com** on your phone browser, sign up (free).
2. Tap **Create App / Import from GitHub** — or first upload this project's
   ZIP file to a new empty GitHub repo using GitHub's own "Add file → Upload
   files" button on **github.com** (works from a phone browser, drag the
   files in from your phone's file manager), then import that repo into Replit.
3. Inside Replit, open the **Shell** tab (a real terminal, running in the
   cloud, not on your phone) and run:
   ```bash
   npm install
   ```
4. Still in that Shell, if you want to check it works, run `npm run dev` —
   Replit gives you a preview link you can open right there in your phone browser.
5. When ready to go live, connect that same GitHub repo to **Vercel** — the
   Vercel website also works fine from a phone browser. Import the repo, add
   your `DATABASE_URL` and `ADMIN_PASSWORD` environment variables (Step C in
   section 2 above), and tap Deploy. Vercel does the `npm install` and build
   on its own servers — your phone doesn't need to do any heavy lifting.

This whole process (GitHub upload → Replit for testing → Vercel for going
live) can be done entirely from a phone browser, no laptop required at any
point.

---

## 3. What to edit for your own branding

| What | Where |
|---|---|
| Food menu items & prices | `/admin` → Menu tab (no code editing needed) |
| UPI ID, brand name, contact number | `/admin` → Settings tab (no code editing needed) |
| Colors (orange/yellow/black theme) | `tailwind.config.js` |
| Home screen text, Hindi copy | `app/page.js` → `HomeScreen` component |
| Admin password | `.env` (locally) or your hosting platform's environment variables (production) → `ADMIN_PASSWORD` |
| App name / tab title | `app/layout.js` → `metadata.title` |

---

## 4. Payments

Every order shows a UPI QR code (built from your Settings → UPI ID) with the
exact amount pre-filled — the customer scans it in any UPI app (PhonePe,
GPay, Paytm, etc.) and pays directly to you, no payment gateway or fees
involved. After paying, the customer taps "मैंने भुगतान कर दिया है", which
flags the order in your Admin dashboard. **You still manually confirm** the
money actually arrived (check your bank/UPI app) before tapping "Payment
Verified" — this keeps things simple and avoids needing a paid payment
gateway integration at this stage.

---

## 5. What's not built yet (by design, for a fast launch)

- Delivery partner app/view (currently: admin manually tells the partner,
  e.g. over phone or WhatsApp, and marks status updates on their behalf)
- OTP login for customers (currently: name + phone captured per order — simple
  and sufficient for launch volume)
- Automatic payment verification (currently: manual, by design — see section 4)

These can be added on top of this codebase later without a rewrite.

---

## 6. Project structure

```
jimlo-webapp/
├── app/
│   ├── page.js              ← customer app (Food Menu + Custom Order + Payment)
│   ├── admin/page.js         ← admin dashboard (Orders / Menu / Settings)
│   ├── layout.js             ← fonts, page title
│   ├── globals.css           ← styling
│   └── api/
│       ├── orders/
│       │   ├── route.js               ← create + list orders
│       │   └── [id]/
│       │       ├── route.js           ← update a single order (admin)
│       │       └── mark-paid/route.js ← customer taps "I have paid"
│       ├── menu/
│       │   ├── route.js               ← list menu (public) + add item (admin)
│       │   └── [id]/route.js          ← edit/delete a menu item (admin)
│       └── settings/route.js          ← UPI ID, brand name, contact number
├── lib/
│   ├── db.js                 ← database connection
│   └── notifyWhatsapp.js     ← optional WhatsApp notification (see below)
├── prisma/
│   ├── schema.prisma         ← database structure
│   └── seed.js                ← starting menu (only used once, at setup)
└── tailwind.config.js        ← EDIT: brand colors
```

---

## 7. Optional: WhatsApp order notifications

By default, new orders show up on `/admin` (refreshes every 8 seconds). If you
also want a WhatsApp message the moment an order comes in, set up a free
[Meta for Developers](https://developers.facebook.com) WhatsApp Business app,
then add these environment variables:
```
WHATSAPP_PHONE_NUMBER_ID="..."
WHATSAPP_ACCESS_TOKEN="..."
WHATSAPP_ADMIN_NUMBER="91XXXXXXXXXX"
```
`lib/notifyWhatsapp.js` already has the code — it just needs these values to
activate. Skippable entirely; the admin dashboard alone is a complete,
working order-management system.
