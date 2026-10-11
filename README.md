# Rooftop Solar Component Catalogue & BOM Generator

A web application for a Bengaluru rooftop solar installer. Customers browse components, configure a rooftop project and get a preliminary bill of materials (BOM). Staff refine that BOM, price it from supplier quotations, track compliance and issue quotations.

Stack: Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · PostgreSQL with Prisma · zod validation · JWT cookie sessions · ExcelJS · PDFKit · Recharts · Vitest.

## What is real and what is a placeholder

| Area | Status |
|---|---|
| Catalogue products, manufacturers, suppliers | **Illustrative templates.** "Sample Manufacturer A–E (illustrative)" are not real companies, and their specifications are plausible values for demonstrating the engine, not claims about any real product. Replace them before real use. |
| Prices | **None seeded.** BOMs stay unpriced until procurement records supplier-quoted prices, each with a quotation reference. |
| GST rates | **Not configured.** Tax classes exist but have no rate. Lines show "GST not configured" and totals are flagged incomplete until a rate and its source are recorded. |
| Compliance sources (BIS, MNRE ALMM, CEA, BESCOM, KERC, IS/IEC) | **Pending verification.** Each record links to the authority's homepage. An engineer must confirm the current revision against the official publication and record it before marking a source verified. |
| Sample project "Bengaluru Commercial Rooftop Solar" | Illustrative. It is read-only to visitors (duplicate it to edit). It has **not** been submitted to BESCOM and holds no approvals. Every checklist item is pending. |
| Email to sales | **Not implemented.** Quote requests and enquiries are stored and appear under Admin → Enquiries & quotes. The UI says plainly that no email was sent. To add email, implement `src/lib/server/notify.ts` against `SMTP_URL`. |
| File storage | An R2 bucket on Cloudflare, or local disk under `STORAGE_DIR` on Node. Files are kept outside `/public` and served only through `/api/documents/[id]`. Quotations store a snapshot of their data, and the browser rebuilds the PDF from it. |
| Company details | Taken from `NEXT_PUBLIC_COMPANY_*`. When unset, pages and PDFs show "not configured" rather than invented details. |
| Generation, savings and payback | Taken from an engineer-verified specific yield when one is entered. Otherwise, once the site is pinned on the map, from a free [PVGIS](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en) estimate for that location, labelled with its source. Savings and payback need the customer's tariff; multi-year projection needs the degradation and analysis-period rules, which have no defaults. Everything is labelled as an estimate, never a guarantee. |
| Subsidies (e.g. PM Surya Ghar) | **No amounts seeded.** The scheme record exists but is inactive with no slabs. Sales enters slab amounts from the official notification under Admin → Subsidies; it can only be activated with slabs and marked verified with an https source. Shown as "estimate only; decided by the scheme authority". |
| Map and roof outline | OpenStreetMap tiles via Leaflet. There is no satellite imagery (no free, licensable source), so a roof outline drawn on the street map is approximate; the measured roof area stays the engineer's input. |
| Web proposal acceptance | Records name, email, time, IP address and browser. It is an electronic acceptance record, **not** a certified digital signature (Aadhaar eSign or DSC would need a paid provider). |

## Setup

You need Node.js 20 or later and a PostgreSQL 14+ database. The quickest local database is Docker:

```bash
docker compose up -d              # Postgres 16 on localhost:5432 (user/password solar/solar, database solarbom)
```

Without Docker, install PostgreSQL directly or use a hosted one (Neon, Supabase, RDS) and put its connection string in `DATABASE_URL`.

```bash
cp .env.example .env              # fill DATABASE_URL, SESSION_SECRET (32+ chars), SEED_DEMO_PASSWORD
npm install
npm run db:deploy                 # apply migrations
npm run db:seed                   # catalogue templates, rules, compliance library, staff, sample project
npm run dev                       # http://localhost:3000
```

To deploy to Cloudflare Workers, see [DEPLOY-CLOUDFLARE.md](DEPLOY-CLOUDFLARE.md).

Checks: `npm run typecheck`, `npm test` (calculation engine), `npm run lint`, `npm run build`.

### Demo staff accounts

The seed creates these accounts, all with the password in `SEED_DEMO_PASSWORD`. Change them, or disable them under Admin → Users, before any shared deployment.

| Email | Role |
|---|---|
| admin@example.com | Administrator |
| sales@example.com | Sales engineer |
| design@example.com | Design engineer |
| procurement@example.com | Procurement |

Customers do not sign in. A project they create is tied to their browser through an httpOnly cookie, and staff can see and edit every project.

## Structure

- `src/lib/engine/`: the calculation engine. It is pure TypeScript with no UI or database code, and covers module count, string design with cold-temperature Voc, inverter evaluation, cable sizing and voltage drop, mounting quantities, protection without duplicating functions built into the inverter, earthing, and pricing with GST. All rule values come from `EngineRule` rows, which are editable under Admin → Engineering rules. Unit tests are in `__tests__/`.
- `src/lib/server/`: data access and workflows: BOM generation and merging, audit log, export data, bulk import, storage and permissions.
- `src/lib/exports/`: PDF, XLSX (with live formulas) and CSV generators. They run in the browser from the JSON the server returns, so no document is generated on the server.
- `src/app/`: pages and API routes. `src/app/admin/actions.ts` holds every admin server action, each checked against `src/lib/server/permissions.ts` and audited.
- `prisma/`: schema, migrations and seed.

## Sales features

- **Site & savings** (project tab): pin the site, draw the roof outline (area computed from the drawing), set tilt, azimuth and losses, get a PVGIS yield estimate, enter the customer's tariff and pick a subsidy scheme. The project page, PDF, Excel ("Savings estimate" sheet) and web proposal show generation, monthly profile, net price after subsidy, first-year savings and payback.
- **Web proposal**: staff with sales permission click "Share link" on a quotation (Quote tab). The customer gets an unguessable link (`/proposal/<token>`) to view the proposal on their phone, download the PDF and accept it online. Staff can copy the link, open WhatsApp or email with it pre-filled (sent from their own app, not the server), or revoke it. Expired proposals can't be accepted.
- **Lead pipeline**: enquiries move through New → Contacted → Site visit → Proposal sent → Won/Lost, with an owner, next follow-up date, notes and a lost reason. The dashboard shows follow-ups due.

### Free external services and their terms

| Service | Used for | Terms to respect |
|---|---|---|
| OpenStreetMap tiles | Map background | Attribution is shown on the map. The [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) suits light use; for heavy traffic switch `TILE_URL` in `src/components/site/SiteMap.tsx` to another provider. |
| Nominatim | Place search on the map | Called from the visitor's browser only when they press Search (max 1 request/second, [usage policy](https://operations.osmfoundation.org/policies/nominatim/)). |
| PVGIS 5.3 (European Commission JRC) | Location yield estimate | Free, no key. Called from the server when staff or the customer press "Estimate yield", throttled to once per 15 s per project. If it is unreachable the page says so; no figure is invented. |

## Rules the application enforces

- A product specification marked manufacturer-verified needs a source datasheet and a verification date. Bulk imports can never mark values as verified.
- A supplier price needs a quotation reference. Expired prices are not applied, and a price someone entered is never overwritten by recalculation.
- A certification or compliance item can be marked "verified" only with an attached evidence document. A certified product does not make a project compliant; the project checklist is reviewed separately.
- Recalculating a BOM keeps manual lines and quantity overrides. It resets engineer verification when a calculated quantity changes, flags lines the engine no longer produces instead of deleting them, and records a revision.
- Only design engineers can mark quantities as engineer-verified, approve revisions, change engineering rules or update compliance status.
- Compatibility checks can be downgraded or switched off by engineering. A switched-off check is still shown on the BOM as information. Voltage and current limits are locked.
- Regulatory values that change over time, such as single-phase limits and sanctioned-load ratios, are rules with no default. They appear as outstanding items until engineering sets them.

## Bulk import format

Download the template from Admin → Bulk import. Required columns are `sku, name, model, category` (slug), `manufacturer` (exact name) and `unit`. Specification columns are written as `spec:<key>[unit]`. The file is fully validated before anything is written, and new products are created as drafts.
