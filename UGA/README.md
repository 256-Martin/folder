# Ugabrush Manufacturing System

Inventory, WIP, direct labour, meals and accounting for **Ugabrush / Deploy Resource
Africa Ltd** — a web rebuild of the 41-tab Google Sheets system (V1.7), seeded with
the real data from that workbook.

Next.js 15 · TypeScript · PostgreSQL · Drizzle ORM · Tailwind CSS

---

## Install PostgreSQL

The app talks to a normal PostgreSQL server over TCP (node-postgres). Pick either
route — both end up at the same connection string.

### Option A — install the server (recommended on Windows)

```powershell
winget install -e --id PostgreSQL.PostgreSQL.18
```

The installer asks for a **superuser password**. Whatever you choose goes into
`DATABASE_URL` in `.env.local`. Everything else can stay at its default:

| Setting | Default | Use it? |
|---|---|---|
| Port | `5432` | yes |
| Superuser | `postgres` | yes |
| Locale | `Default locale` | yes |
| Data directory | `C:\Program Files\PostgreSQL\18\data` | yes |
| Stack Builder at the end | — | skip it |

Then create the database (adjust `18` to your version):

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "CREATE DATABASE ugabrush;"
```

Add `C:\Program Files\PostgreSQL\18\bin` to your PATH to use `psql` directly.

### Option B — Docker

```bash
docker compose up -d
```

`docker-compose.yml` starts PostgreSQL 17 with the database, user and password
already matching `.env.local`. Nothing else to configure.

---

## Quick start

```bash
npm install
npm run db:generate     # build the SQL migration from the schema
npm run setup           # create the schema and seed the real data
npm run dev             # http://localhost:3000
```

Sign in with **muenoch@gmail.com** / **ugabrush2026**.

`.env.local` is pre-filled with:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ugabrush
```

Change the password to the one you chose during installation. If the server is not
running or the credentials are wrong, the CLI scripts say exactly what is wrong
rather than printing a driver stack trace.

Seeded accounts (all password `ugabrush2026` — change them before go-live):

| Email | Name | Role |
|---|---|---|
| muenoch@gmail.com | Enoch | ADMIN |
| prossy@ugabrush.local | Ms. Prossy | TEAM |
| viewer@ugabrush.local | Viewer | VIEW |

---

## What's in it

**39 pages**, one home for every tab of the original workbook.

| Group | Pages |
|---|---|
| Overview | Dashboard |
| Record | Purchases · Inventory Ledger · Batch Register · Production Operations · Sales & Dispatch · Meals · Deductions · Expenses & Providers |
| Stock & WIP | WIP Summary · Material Stock · Handle Stock · U-Staple Stock · Finished Goods |
| Labour & Pay | Direct Labour · Worker Productivity · Meal Qualification · Meal Deductions · Final Worker Payment |
| Analytics | Supplier & Batch Scorecard · Reports & Print Centre |
| Master Data | Items · Suppliers · Workers · Processes · Worker Skills · Piece Rates |
| Settings | System · Meal Cost · Meal Qualification Rules · Lists & Dropdowns · Accounting Export · Report Header |
| System | Data Issues · Audit Log · Report Log · Void Register · Batch Renames · Help |

Plus **19 print-ready reports** and **9 accounting CSV exports** driven by the
Accounting Export Settings mapping table.

### Business logic carried over

- **Stock is never stored.** Every balance is the signed sum of Inventory Ledger
  movements, with signs configurable per movement type under Settings → Lists.
- **9-stage WIP** with the handle→brush identity crossover at TUFT.
- **Effective-dated piece rates.** The rate in force on the operation date is applied
  and snapshotted onto the row, so later rate changes never rewrite history.
- **The full 26-rule meal engine** — daily per-process thresholds, 20 weekly tufting
  tiers, Max/Add combination, daily and weekly caps, Monday week start, expiry at
  week end.
- **19 automated data checks** rolled up on the Data Issues page.
- **Batch traceability** from supplier lot through to output and defect rate.
- **Void and restore** with a full JSON snapshot; nothing is ever deleted.
- **Audit logging** on every mutation, with the acting user attached.

---

## Roles

| Role | Can do |
|---|---|
| **ADMIN** | Everything: masters, settings, corrections, voids, audit log, reports |
| **TEAM** | Record daily work; read every view |
| **VIEW** | Read-only; no entry forms are rendered |

---

## Testing

```bash
npm run verify           # 60 checks against real spreadsheet figures
npm run test:functional  # 41 checks of the write path and calculation chain
npm run test             # both
npm run test:smoke       # 68 HTTP checks — needs `npm run dev` running
```

`verify` asserts the engine reproduces the workbook: HAIR balance 14,505 · HDL-S
1,984 · finished goods 100 · total purchase spend 7,693,735 UGX · the full supplier
scorecard · the July meal figures.

`functional` records a simulated production day, checks WIP, labour, meal
qualification and payroll all respond correctly, exercises void and restore, then
rolls everything back.

---

## Deploying to Vercel + Neon

Neon speaks standard PostgreSQL, so the same driver and the same code run against
it — only `DATABASE_URL` changes. Supabase, Railway, or Postgres on your own VPS
work identically.

1. **Create a Neon project** and copy the **pooled** connection string
   (the host contains `-pooler`). Keep `?sslmode=require` on the end.
2. **Push this folder to a Git repo** and import it in Vercel.
3. **Set environment variables** in Vercel:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | your Neon pooled connection string |
   | `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `NEXT_PUBLIC_ENV_LABEL` | `Production` |

4. **Create the schema and seed**, from your machine, pointed at Neon:

   ```bash
   DATABASE_URL="postgresql://..." npm run db:push
   DATABASE_URL="postgresql://..." npm run db:seed
   ```

   On Windows PowerShell:
   ```powershell
   $env:DATABASE_URL="postgresql://..."; npm run db:push; npm run db:seed
   ```

5. **Deploy**, then **change the seeded passwords immediately.**

`AUTH_SECRET` is mandatory in production — the app refuses to sign sessions without a
strong value.

**TLS** is enabled automatically for any remote host and disabled for `localhost`.
If your provider uses a self-signed certificate, set `DATABASE_SSL=no-verify`.

**Connection pooling** defaults to 10 connections, or 1 when `VERCEL` is set, since
serverless invocations are short-lived. Override with `DATABASE_POOL_MAX`.

---

## Project layout

```
src/
  app/
    (app)/            all authenticated pages
    login/            sign-in
    api/
      logout/
      export/[key]/   accounting CSV downloads
  components/         UI kit, charts, forms, navigation
  db/
    schema.ts         26 tables
    seed-data.json    extracted from the workbook
  lib/
    core.ts           the calculation engine
    meal-engine.ts    qualification and costing
    reports.ts        the 19 report definitions
    exports.ts        CSV journal builders
    actions/          server actions (write path)
scripts/
  extract_seed.py     workbook -> JSON
  seed.ts             JSON -> database
  verify-parity.ts    spreadsheet parity harness
  functional.ts       write-path tests
  smoke.ts            HTTP route tests
```

---

## Re-importing from the spreadsheet

```bash
python scripts/extract_seed.py "path/to/Ugabrush Manufacturing System V1.7.xlsx"
npm run db:reset && npm run setup
```

Requires `openpyxl` (`python -m pip install openpyxl`).

---

## Notes

- Currency is UGX throughout; timezone Africa/Kampala.
- Dark mode follows the system preference and can be toggled in the sidebar.
- Reports print cleanly — the shell is hidden via a print stylesheet, so
  **Print → Save as PDF** produces a proper document.
- See **DEVIATIONS.md** for the eight documented differences from the spreadsheet.
