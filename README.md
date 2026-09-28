# OSU P-Card Audit — Web App

A two-tab internal-audit web app for Oklahoma State University purchasing-card (P-Card)
transactions:

- **Ask a question** — query the data in plain English; the server translates it to SQL, runs it, and answers.
- **Prohibited-purchase dashboard** — pick an audit year and search transactions by description or vendor.

Built with Next.js (App Router) and a read-only SQLite database via `better-sqlite3`.

---

## Prerequisites

- **Node.js 20+** (developed on 22)
- **`data/pcards.db`** — the SQLite database (~145 MB). It exceeds GitHub's 100 MB file
  limit, so it is **not** stored in this repository. Place your copy at `data/pcards.db`
  before running.

## Setup

```bash
npm install

# Add your Gemini API key (only needed for the natural-language tab)
cp .env.local.example .env.local
$EDITOR .env.local          # paste a free key from https://aistudio.google.com/apikey

npm run dev                 # http://localhost:3000
```

The dashboard tab works without an API key. The natural-language tab returns a clear
"key not set" message until you add one.

Google AI Studio issues Gemini API keys free with just a Google account — no payment
method required. The app defaults to `gemini-3.6-flash`; set `GEMINI_MODEL` in
`.env.local` to use a different one. If Google has retired the default model for your key,
the Ask tab's error names the current replacement — put that in `GEMINI_MODEL`.

> **Never commit your API key.** It is read server-side from `.env.local`, which is
> gitignored, and is never sent to the browser.

## Production build

```bash
npm run build && npm start
```

---

## The two tabs

### Tab 1 — Ask a question

Ask in plain English. The server sends your question to Gemini with a `run_sql` function
tool. The model writes SQLite, runs it against the database, reads the rows, and can query
again to refine before answering in prose. Every query it ran is shown in an expandable
panel so you can verify the work.

**Safety.** SQL never comes from the browser and is never trusted:

- the SQLite connection is opened `readonly` with `query_only` set
- statements must begin with `SELECT` or `WITH`
- multiple statements are rejected
- `ATTACH`, `PRAGMA`, `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE` and friends are rejected
- results are capped at 500 rows and the loop at 8 turns

### Tab 2 — Prohibited-purchase dashboard

Pick an audit year, then run two clearly separated searches:

- **Description search** — keyword against the line-item description (what was bought)
- **Vendor search** — keyword against the merchant name (who was paid)

Results show transaction date, posted date, cardholder, amount, vendor, description and
MCC — everything needed for follow-up — with a match count and total value. Keywords are
passed as bound parameters, never concatenated into SQL.

---

## Deploying

This is a Node server (not a static site), so it needs a host that runs Node — a static
host or plain web hotel will not work. Any Node host is fine; the two things every deploy
needs are:

1. **`GEMINI_API_KEY`** set as an environment variable on the host (never in the repo).
2. **`data/pcards.db`** made available to the server. Because the file is too large for
   the repo, fetch it at build time from wherever you keep it, or upload it to the host's
   disk.

The database is opened read-only, so no writable storage is required at runtime.
