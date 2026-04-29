# Invoice Generator

A SvelteKit app for generating batches of PDF invoices. Configure a sender identity, add clients with service details and invoice months, then bulk-generate and download PDFs individually or as a ZIP.

---

## Features

- Bulk PDF generation (html2canvas + jsPDF, fully client-side)
- Multiple clients, each with their own invoice schedule
- Bank or Wise payment section per client
- ZIP download via fflate (no compression overhead)
- Google OAuth gate via Better Auth
- Live invoice preview before generating

---

## Tech Stack

| Layer         | Technology                            |
| ------------- | ------------------------------------- |
| Framework     | SvelteKit 2 + Svelte 5 (runes)        |
| Styling       | Tailwind CSS v4                       |
| UI Components | shadcn-svelte                         |
| Auth          | Better Auth (Google OAuth)            |
| Database      | Cloudflare D1 + Drizzle ORM           |
| PDF           | html2canvas + jsPDF                   |
| ZIP           | fflate                                |
| Deployment    | Cloudflare Workers                    |
| Package mgr   | Bun                                   |

---

## Setup

**Prerequisites**: Bun, a Cloudflare account, a Google Cloud OAuth 2.0 app.

```bash
bun install
```

Copy `.dev.vars.example` (or create `.dev.vars`) with:

```
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:5173
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
```

Apply the D1 migration locally:

```bash
bun run db:migrate:local
```

Start the dev server:

```bash
bun run dev
```

> Auth requires the Wrangler-backed server. For full auth testing use `bun run preview` instead.

---

## Environment Variables

| Variable               | Required | Description                                  |
| ---------------------- | -------- | -------------------------------------------- |
| `BETTER_AUTH_SECRET`   | Yes      | Random secret for session signing            |
| `BETTER_AUTH_URL`      | Yes      | Deployed URL (set as a Wrangler `var`)       |
| `GOOGLE_CLIENT_ID`     | Yes      | Google OAuth client ID                       |
| `GOOGLE_CLIENT_SECRET` | Yes      | Google OAuth client secret                   |

The `BETTER_AUTH_URL` var is already set in `wrangler.jsonc` for production. The other three are secrets — never commit them.

---

## Scripts

```bash
bun run dev          # Start dev server
bun run build        # Production build
bun run preview      # Build + Wrangler dev (required for auth testing)
bun run check        # TypeScript validation
bun run lint         # ESLint
bun run format       # Prettier
bun run cf-typegen   # Regenerate Cloudflare types from wrangler.jsonc
bun run db:migrate   # Apply D1 migrations (remote)
bun run db:migrate:local  # Apply D1 migrations (local)
```

---

## Deployment

```bash
bun run build
wrangler deploy
```

Set production secrets via Wrangler before the first deploy:

```bash
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
```

Add the following redirect URI to your Google OAuth app:

```
https://<your-worker>.workers.dev/api/auth/callback/google
```

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URIs:
   - `http://localhost:5173/api/auth/callback/google` (local)
   - `https://<your-worker>.workers.dev/api/auth/callback/google` (production)

---

## License

[MIT](LICENSE) — Rahi Khan, 2026
