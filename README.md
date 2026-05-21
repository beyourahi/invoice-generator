# Invoice Generator

A SvelteKit app for generating batches of PDF invoices. Configure a sender identity, add clients with service details and invoice months, then bulk-generate and download PDFs individually or as a ZIP. An optional AI Copilot drives the same client and invoice operations through natural-language commands.

**Live**: https://invoice-generator.beyourahi.workers.dev

---

## Tech Stack

| Layer         | Technology                           |
| ------------- | ------------------------------------ |
| Framework     | SvelteKit 2 + Svelte 5 (runes)       |
| Styling       | Tailwind CSS v4                      |
| UI Components | shadcn-svelte                        |
| Auth          | Better Auth (Google OAuth)           |
| Database      | Cloudflare D1 + Drizzle ORM          |
| AI            | Cloudflare Workers AI (GPT-OSS 120B) |
| PDF           | html2canvas + jsPDF                  |
| ZIP           | fflate                               |
| Deployment    | Cloudflare Workers                   |
| Package mgr   | Bun                                  |

---

## Setup

**Prerequisites**: Bun, a Cloudflare account, a Google Cloud OAuth 2.0 client.

```bash
bun install
```

Copy the example env files and fill in the values:

```bash
cp .dev.vars.example .dev.vars   # auth secrets — read by wrangler dev
cp .env.example .env             # Cloudflare credentials — read by drizzle-kit
```

Apply migrations and start:

```bash
bun run db:migrate:local
bun run dev              # http://localhost:5173
```

> Auth requires the Wrangler-backed server. Use `bun run preview` for full auth testing.

---

Two gitignored files at the project root, each read by a different tool — copy [`.dev.vars.example`](./.dev.vars.example) and [`.env.example`](./.env.example).

`.dev.vars` — Worker runtime secrets, loaded by `wrangler dev`:

| Variable               | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `BETTER_AUTH_SECRET`   | Random secret for session signing                 |
| `BETTER_AUTH_URL`      | Worker base URL — `http://localhost:8787` locally |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                            |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                        |

`.env` — drizzle-kit credentials, loaded by Bun for `bun run db:*`:

| Variable                 | Description                                  |
| ------------------------ | -------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`  | Cloudflare account ID                        |
| `CLOUDFLARE_DATABASE_ID` | D1 database ID                               |
| `CLOUDFLARE_D1_TOKEN`    | Cloudflare API token with D1 edit permission |

Wrangler reads `.dev.vars` (not `.env`) for the Worker. In production, set the `.dev.vars` values as Worker secrets via `wrangler secret put`; `BETTER_AUTH_URL` is a non-secret binding in `wrangler.jsonc`. Never commit `.dev.vars` or `.env`.

---

## Scripts

| Script                     | Description                            |
| -------------------------- | -------------------------------------- |
| `bun run dev`              | Dev server on `:5173`                  |
| `bun run preview`          | Wrangler local preview (auth testing)  |
| `bun run build`            | Production build                       |
| `bun run check`            | TypeScript validation                  |
| `bun run lint`             | ESLint                                 |
| `bun run format`           | Prettier auto-format                   |
| `bun run cf-typegen`       | Regenerate Cloudflare types            |
| `bun run db:generate`      | Generate migration from schema changes |
| `bun run db:migrate`       | Apply migrations to production D1      |
| `bun run db:migrate:local` | Apply migrations to local D1           |

---

## Deployment

Set production secrets, then deploy:

```bash
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
bun run build
wrangler deploy
```

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URIs:
   - `http://localhost:8787/api/auth/callback/google` (local — Wrangler dev server)
   - `https://invoice-generator.beyourahi.workers.dev/api/auth/callback/google` (production)

---

## License

MIT — see [LICENSE](./LICENSE).

## Author

**Rahi Khan** · [beyourahi.com](https://beyourahi.com) · [beyourahi@gmail.com](mailto:beyourahi@gmail.com)
