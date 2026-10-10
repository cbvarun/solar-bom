# Deploying to Cloudflare Workers

The app runs on Cloudflare Workers through the [OpenNext adapter](https://opennext.js.org/cloudflare). It uses three Cloudflare pieces:

| Need | Cloudflare piece | Binding |
|---|---|---|
| PostgreSQL | Hyperdrive in front of a hosted Postgres (Neon, Supabase, RDS…) | `HYPERDRIVE` |
| Uploaded datasheets and certificates | R2 bucket | `FILES` |
| Static files, including the fonts used for PDFs | Workers static assets | `ASSETS` |

Cloudflare has no hosted PostgreSQL, and D1 (SQLite) cannot run this schema, so the database itself lives with a Postgres provider.

**Plan:** you can start on the **free plan**. The minified bundle is about 2.6 MB gzipped, under the free plan's 3 MB limit. The free plan allows 10 ms of CPU per request, so PDF, Excel and CSV exports are built in the visitor's browser: the server only returns the BOM data as JSON, and quotations store that data so their PDF can be rebuilt exactly. Page rendering still runs on the server and has not been measured against the 10 ms limit on Cloudflare itself. If pages fail with error 1102 ("Worker exceeded resource limits"), move to **Workers Paid** ($5/month). Bulk import of large .xlsx files is also parsed on the server, so prefer CSV for big imports on the free plan.

## 1. Database (Neon)

1. Create a project at [neon.tech](https://neon.tech). Choose the region closest to your users (Singapore for Bengaluru).
2. Copy the connection string. It looks like `postgresql://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`.
3. Create the tables and load the starting data from your own machine:

   ```bash
   # in .env
   DATABASE_URL="<the Neon connection string>"
   SEED_DEMO_PASSWORD="<a strong password for the demo staff accounts>"

   npm run db:deploy
   npm run db:seed
   ```

   Run these two commands again whenever a later version adds migrations. Change or deactivate the demo accounts (Admin → Users) before real use.

## 2. Cloudflare resources

```bash
npx wrangler login
npx wrangler hyperdrive create solar-bom-db --connection-string="<the Neon connection string>"
npx wrangler r2 bucket create solar-bom-files
```

Paste the Hyperdrive `id` printed by the first command into `wrangler.jsonc` in place of `REPLACE_WITH_HYPERDRIVE_ID`.

## 3. Secrets and company details

```bash
npx wrangler secret put SESSION_SECRET      # 32+ random characters: openssl rand -base64 48
```

`NEXT_PUBLIC_COMPANY_*` values are built into the pages, so set them in `.env` on the machine that runs the deploy. `DATABASE_URL` is not used on Workers, because the app reaches the database through Hyperdrive.

## 4. Deploy

```bash
npm run cf:deploy
```

This builds the app with OpenNext and uploads it. The app is served at `https://solar-bom.<your-subdomain>.workers.dev`. To use your own domain, add it under Workers → solar-bom → Settings → Domains & Routes.

### Deploying from GitHub instead

In the dashboard, choose **Workers & Pages → Create → Import a repository** (the Workers option, not Pages) and pick this repository. Set the build command to `npx opennextjs-cloudflare build` and the deploy command to `npx opennextjs-cloudflare deploy`. Add the `NEXT_PUBLIC_COMPANY_*` values as build variables and `SESSION_SECRET` as a secret under the Worker's Settings → Variables and Secrets. Every push to `main` then deploys. `npm install` runs `prisma generate`, so the build has the database client.

## Testing locally in the Workers runtime

```bash
docker compose up -d                  # local Postgres (solar/solar), matches localConnectionString in wrangler.jsonc
cp .dev.vars.example .dev.vars        # and set SESSION_SECRET
npm run cf:preview                    # http://localhost:8787
```

R2 is simulated locally under `.wrangler/`.

## How the code handles both runtimes

- `src/lib/db.ts` gives each Workers request its own Prisma client over the Hyperdrive connection, because Workers cannot share connections between requests. On Node it keeps a single client that uses `DATABASE_URL`.
- `src/lib/server/storage.ts` writes to R2 on Workers and to `STORAGE_DIR` on Node.
- Exports are generated in the browser by `src/lib/exports/` from `GET /api/projects/[id]/export-data`, which keeps document generation off the Worker. The PDF fonts are served from `public/fonts`.
- Prisma uses its WebAssembly query compiler with the `pg` driver adapter. That combination runs on both runtimes.

`npm run dev`, `npm run build` and `npm start` still work as plain Node, so the app can also be deployed to any Node host.
