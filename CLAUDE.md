# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Always Do First

**Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.

---

## Git Workflow

**NEVER CREATE BRANCHES.** Use git worktrees for parallel work:

```bash
git worktree add ../invoice-generator-<feature>
git worktree list
git worktree remove ../invoice-generator-<feature>
git worktree prune
```

All commits go directly to `main`. No feature branches. Worktrees allow parallel development without branch switching or stashing.

**Always break large tasks into focused scopes** — run parallel agents with git worktrees, each with a narrow, well-defined goal.

---

## Project Overview

A SvelteKit app that generates batches of PDF invoices. Users configure a fixed sender identity, add multiple clients (each with service details and a list of invoice months), then trigger bulk generation. Each invoice is rendered as HTML, captured via `html2canvas`, and exported to a jsPDF Blob. Multiple PDFs can be downloaded individually or zipped together via `fflate`.

**Stack**: SvelteKit 2 + Svelte 5 runes, Tailwind CSS v4, shadcn-svelte, Cloudflare Workers, Better Auth (Google OAuth), Cloudflare D1, Drizzle ORM, Bun.

**Auth-gated**: Google OAuth via Better Auth. Any authenticated user can access the app. Unauthenticated users are redirected to `/login`. The PDF generation pipeline itself is still entirely client-side (no server actions). The server layer handles only auth session management and routing guards.

---

## Tech Stack

| Layer           | Technology                                       |
| --------------- | ------------------------------------------------ |
| Framework       | SvelteKit 2.x (Svelte 5 with runes)              |
| Language        | TypeScript (strict mode)                         |
| Styling         | Tailwind CSS v4 (CSS-first config, OKLCH colors) |
| UI Components   | shadcn-svelte                                    |
| Authentication  | Better Auth (Google OAuth only)                  |
| Database        | Cloudflare D1 (SQLite via Drizzle ORM)           |
| Validation      | Zod                                              |
| PDF Rendering   | html2canvas + jsPDF                              |
| ZIP Packaging   | fflate (`zipSync`, `level: 0`)                   |
| Animations      | None (shadcn Progress + Lucide Loader2 spinner)  |
| Deployment      | Cloudflare Workers                               |
| Package Manager | Bun                                              |
| Linting         | ESLint 9 flat config + Prettier                  |

---

## Commands

```bash
bun run dev              # Start Vite dev server (opens browser automatically)
bun run build            # Production build
bun run preview          # Preview via Wrangler (requires build first)
bun run check            # svelte-check TypeScript validation
bun run lint             # ESLint
bun run format           # Prettier
bun run cf-typegen       # Regenerate worker-configuration.d.ts from wrangler.jsonc
bun run db:generate      # Generate Drizzle migration files
bun run db:push          # Push schema directly to D1 (skips migration files)
bun run db:pull          # Pull schema from D1
bun run db:migrate       # Apply pending migrations to remote D1
bun run db:migrate:local # Apply pending migrations to local D1
bun run db:migrate:list  # List applied migrations
bun run db:check         # Check migration consistency
bun run db:studio        # Launch Drizzle Studio GUI
```

---

## Architecture

### Path Aliases

Two aliases are configured in `svelte.config.js`:

- `$lib` → `src/lib/` (SvelteKit default)
- `$src` → `src/` (custom, used in route files to import from `src/components/`)

Route files use `$src/components/...`; library files use `$lib/...`. Never use relative paths.

### Auth Layer

The server layer handles only authentication — the PDF pipeline itself remains entirely client-side.

- **`$lib/server/auth.ts`** — `createAuth(d1, env)` factory. Returns a Better Auth instance configured with Google OAuth, Drizzle adapter (D1/SQLite), 7-day session expiry, 5-minute cookie cache, and database rate limiting. `env` must include `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

- **`$lib/server/schema.ts`** — Drizzle schema for Better Auth tables: `users`, `sessions`, `accounts`, `verifications`, `rateLimits`. Snake_case column names required by the Drizzle adapter.

- **`$lib/auth-client.ts`** — Better Auth Svelte client (`createAuthClient`). Exports `authClient`, `signIn`, `signOut`, `useSession`.

- **`$lib/config/app.ts`** — `APP_CONFIG` object (`name`, `description`, `url`, `author`). App metadata used for `<title>` and `<meta>` tags. Exported via `$lib/config/index.ts`.

- **`$lib/hooks/use-current-user.ts`** — `getCurrentUser(user)` → `CurrentUser | null`. Accepts a `{ name, email }` object and returns a `CurrentUser` or `null` for unauthenticated users.

- **`src/hooks.server.ts`** — SvelteKit `handle` hook. Instantiates `createAuth` per request (D1 binding from `event.platform.env`), delegates Better Auth routes to `svelteKitHandler` (from `better-auth/svelte-kit`), calls `auth.api.getSession`, populates `event.locals.user`, `event.locals.session`, `event.locals.currentUser`. Also applies CSP and security headers on every response. Gracefully degrades if D1 is unavailable (auth disabled, locals set to `null`). Also exports `handleError` for server-side error logging with UUID correlation.

- **`src/hooks.client.ts`** — Client-side `handleError` that logs errors with a UUID for correlation.

- **`src/routes/+layout.server.ts`** — Passes `user`, `session`, `currentUser` from `locals` into `PageData`.

- **`src/routes/+page.server.ts`** — Redirects to `/login` if `locals.user` is null. Returns `user` and `currentUser` from `locals`.

- **`src/routes/login/+page.svelte`** — Google sign-in button. Redirects to `/` (or `?redirect=`) after successful OAuth. Shows error message on failure.

- **`src/routes/login/+page.server.ts`** — Redirects to `/` if already authenticated.

- **`src/routes/api/logout/+server.ts`** — `POST`/`GET` both delete the session cookie and redirect to `/login`.

- **`migrations/0001_better_auth_tables.sql`** — Raw SQL migration for D1. Apply via `bun run db:migrate` (remote) or `bun run db:migrate:local` (local Wrangler preview).

**Authorization flow**: Google OAuth → any authenticated user gains full access to the invoice app. Unauthenticated users are redirected to `/login`.

### Store Design

Both stores use the **factory function + `$state` closure** pattern, exported as singletons:

- **`$lib/stores/session.svelte.ts`** — Ephemeral per-session state: the `clients` array, `generatedInvoices`, `generationState` (`"idle" | "generating" | "done" | "error"`), and `generationError`. Client mutations are exposed as discrete methods: `addClient`, `removeClient`, `updateClient(id, updater)`, `addInvoiceEntry`, `removeInvoiceEntry`, `updateInvoiceEntry`. Generation lifecycle methods: `setGenerating`, `setGenerated`, `setError`, `resetGeneration`. Two `$derived` computed values: `totalInvoiceCount` and `allClientsValid` — the latter checks that every client has a non-empty `name` and `invoicePrefix` (those two fields only).

- **`$lib/stores/fixed.svelte.ts`** — Persistent sender/bank data, stored in `localStorage` under key `invoice-generator:fixed`. Has a lazy `init()` method called in `+layout.svelte`'s `onMount` (SSR guard) before reads are meaningful.

The factory pattern is required because Svelte 5 `$state` reactivity is scoped to its declaration; returning objects with explicit `get` accessors exposes the reactive values outside the module.

### Invoice Pipeline

1. **`$lib/invoice/builder.ts`** — `buildInvoiceHtml(client, entry, fixed, theme)` assembles a complete HTML document string. Calls `resolveTokens` to substitute `{TOKEN}` placeholders. Invoice ID format: `{PREFIX}-{MM}{DD}-{YEAR}` (e.g. `ACME-0101-2026`). Service description supports a `{MONTH}` token (substituted via `String.prototype.replace`, not `resolveTokens`). Also exports three pure helpers used by `GenerationPanel`: `getInvoiceId(client, entry)`, `getFileName(client, entry)` → `invoice-{PREFIX}-{MM}{DD}-{YEAR}.pdf`, and `getFolderName(client)` → `{ClientName}-{Year}-Invoices`.

2. **`$lib/invoice/resolver.ts`** — Single pure function: string template + token map → resolved string via `replaceAll`.

3. **`$lib/invoice/months.ts`** — `MONTHS` array of all `MonthName` values and `MONTH_TO_NUMBER` map (`"January" → "01"`, etc.) used by invoice entry UI.

4. **`$lib/pdf/generator.ts`** — Entirely client-side. Injects the HTML into a hidden off-screen `<iframe>`, waits for fonts, runs `html2canvas` at 2× scale on the iframe body (A4: 794×1123px), then writes the canvas to a jsPDF at 210×297mm. Returns a `Blob`.

5. **`$lib/pdf/zip.ts`** — Collects all `GeneratedInvoice` Blobs into a `fflate` `zipSync` with paths `{ClientName}-{Year}-Invoices/{fileName}.pdf`. `level: 0` (store-only, no compression) since PDFs are already compressed.

### Theme System

`$lib/themes/registry.ts` maps `ThemeId` → `Theme`. A `Theme` contains four strings: `html` (full document template), `css` (minified stylesheet injected into `{CSS}`), `bankPayment`, and `wisePayment` (partial HTML for the payment section). Only one theme exists: `default`. `ACTIVE_THEME_ID` is the hardcoded active theme.

To add a theme: implement the `Theme` interface in a new file, register it in `themes` in `registry.ts`, and update `ThemeId`.

### UI Layout

The main page (`+page.svelte`) renders the invoice app for any authenticated user. Unauthenticated users are redirected to `/login` server-side before the page renders.

**App layout** — two-column grid at `lg` breakpoint:

- **`User`** — fixed-position avatar + sign-out button (`src/components/User.svelte`), rendered top-right when the user is authenticated. Shows the user's avatar image (or a fallback icon), expands on hover to reveal name and email, and has a separate sign-out button with a loading spinner. Calls `authClient.signOut()` then redirects to `/login`.
- **`Heading`** — shared heading component (`$lib/components/ui/heading/heading.svelte`) rendered above the grid
- **Left column** — `FixedSenderPanel` + `ClientCard` list + `AddClientButton` (ephemeral session state)
- **Right column** (sticky) — `InvoicePreview` (live scaled iframe of first invoice for the selected client)
- **Below grid** (full-width, after `<Separator>`) — `GenerationPanel`

`GenerationPanel` owns the generate loop: iterates `session.clients → client.invoices`, calls `buildInvoiceHtml` + `generatePdf` sequentially (each PDF render is async/blocking), tracks progress with a local `$state<number>` (0–100) bound to a shadcn `Progress` component. On completion, renders a `Table` of generated invoices with per-row download buttons and a ZIP button. Uses `svelte-sonner` toast (lazy-imported via dynamic `import()`) for success/error feedback.

### InvoicePreview

`src/components/InvoicePreview.svelte` renders a live scaled preview of the first `invoices[0]` entry for the selected client. Uses an iframe with `srcdoc={html}`, measures container width via a Svelte action (`use:measurePreview`) using `requestAnimationFrame` + `window.addEventListener("resize")`, and derives a CSS scale factor (`containerWidth / 794`) to fit A4 (794×1123px) into the panel. When no client is selected or no invoice entry exists, shows an empty state. The selected client is tracked as `selectedClientId` state in `+page.svelte`, defaulting to `session.clients[0]`.

### Toast Notifications

`svelte-sonner` (via shadcn `sonner` component) provides success/error toasts. The `Toaster` component is lazy-imported in `onMount` in `+page.svelte` (SSR guard — `localStorage` and `document` are unavailable during SSR). Individual toasts are fired from `GenerationPanel` via `import("svelte-sonner")` dynamic imports inside async handlers.

---

## Development Principles

- **PDF pipeline is client-side only** — `builder.ts`, `generator.ts`, `zip.ts`, and all stores run in the browser. The server layer (`hooks.server.ts`, `+page.server.ts`, `+layout.server.ts`, `/api/logout`) handles only auth session management.
- **Prefer existing abstractions** — check `$lib/` before creating new utilities.
- **No duplication** — if logic exists in `resolver.ts`, use it; don't inline token-substitution calls elsewhere.
- **Minimal scope** — No animation library. Use shadcn `Progress`, `Skeleton`, and Lucide `Loader2` for UI feedback. Don't add GSAP or other animation libraries.
- **Performance** — PDF generation is blocking by design. Each `generatePdf()` call is sequential. Do not parallelize (browser canvas limits).
- **Type safety** — TypeScript strict mode. No `any` except for external library compatibility.

---

## Coding Conventions

### Svelte 5 Runes (mandatory)

```svelte
<script lang="ts">
	// Props
	let { client, onUpdate }: ClientCardProps = $props();

	// State
	let expanded = $state(false);

	// Derived
	let isValid = $derived(client.name.length > 0);
</script>
```

- `$state`, `$derived`, `$props`, `$effect` — never legacy `export let` or `$:` reactive statements
- `$effect` only for side effects with external systems; prefer `onMount` for DOM/lifecycle work
- Svelte `writable` stores only for global cross-component state in `$lib/stores/`

### TypeScript

- Strict mode. No `any`. No loose casts.
- `import type { ... }` for type-only imports
- All component prop types defined explicitly (never implicit)
- `cn()` from `$lib/utils` for conditional class merging

### Imports

```typescript
// Correct — use aliases
import { session } from "$lib/stores/session.svelte";
import ClientCard from "$src/components/ClientCard.svelte";

// Wrong — never relative paths from route files
import { session } from "../../../lib/stores/session.svelte";
```

### Arrow Functions

```typescript
// Correct
const generateAll = async () => { ... };

// Wrong — no function declarations
function generateAll() { ... }
```

### Zero Comments

No inline, block, or JSDoc comments in shipped code. Names and structure must be self-documenting.

### Tailwind CSS v4

- CSS-first config in `src/app.css` under `@theme inline`. No `tailwind.config.js`.
- CSS variables only for colors — never hardcode hex/rgb/oklch values directly.
- Design is **dark-only**. No light mode. All `--color-*` tokens are dark values.

### shadcn-svelte Components

Components in `$lib/components/ui/` are auto-generated. Never modify them. Create wrappers elsewhere.
Add components: `bunx shadcn-svelte@latest add <component>`

---

## Code Style

- **Indentation**: Tabs (`.svelte` files: 4-space tab width for Prettier)
- **Quotes**: Double quotes
- **Trailing commas**: None
- **Print width**: 100 (120 for `.svelte`)
- **Arrow parens**: avoid (`x => x`)
- **Plugins**: prettier-plugin-svelte, prettier-plugin-tailwindcss (auto-sorts Tailwind classes)

---

## Agent Behavior Guidelines

- **Read before write** — always use the Read tool before Edit/Write.
- **No assumptions** — verify the invoice pipeline, store signatures, and theme structure before modifying them. Read the source file first.
- **Prefer existing abstractions** — `resolver.ts` exists for token substitution. `generator.ts` owns the iframe/canvas/jsPDF pipeline. Do not replicate this logic inline.
- **No scope creep** — a bug fix does not need surrounding cleanup. A new theme does not need a theme-switcher UI unless asked.
- **Validate Svelte code** — run `svelte-autofixer` (svelte MCP) before delivering any `.svelte` file changes.
- **Validate before committing** — run `bun run check` and `bun run lint` before every commit. Never commit failing builds.
- **No feature flags** — this is a single-user tool. No A/B testing, no staged rollouts.
- **No backwards-compat shims** — if you change a store shape, update all callers. Don't add legacy adapters.

---

## MCP & Tooling Usage

Consult MCP tools in this priority order:

1. **`svelte` MCP** — for any Svelte 5 or SvelteKit code
   - `list-sections` → discover doc sections
   - `get-documentation` → fetch relevant sections
   - `svelte-autofixer` → **mandatory** before delivering Svelte code
2. **`context7` MCP** — for Tailwind CSS v4, shadcn-svelte, jsPDF, html2canvas, fflate, svelte-sonner
3. **Web search** — last resort

Never use `shopify-dev` MCP (this is not a Shopify project).

---

## Testing Practices

No test framework is currently configured. Validation is done through:

- `bun run check` — svelte-check with strict TypeScript
- `bun run lint` — Prettier formatting + ESLint rules
- Manual testing: generate PDFs, verify file names, verify ZIP structure, test with multiple clients and months

When adding tests:

- Use Vitest (compatible with the Vite setup)
- Priority test targets: `resolver.ts` (token substitution), `builder.ts` (invoice ID format), `zip.ts` (path generation)
- Place test files alongside source: `*.test.ts`

---

## Repository Etiquette

### Conventional Commits

```
feat:     new feature
fix:      bug fix
refactor: code restructuring without behavior change
style:    visual/UI changes only
chore:    tooling, config, dependencies
docs:     documentation changes
perf:     performance improvements
```

### Commit Discipline

- Atomic commits — one logical change per commit
- Never commit `.env`, `.dev.vars`, or any file with secrets
- Run `bun run lint` and `bun run check` before every commit
- Each commit must build successfully

---

## Development Environment

### Prerequisites

- **Bun** (package manager and runtime)
- **Wrangler** (Cloudflare Workers CLI, installed as devDependency)
- **Git 2.5+** (for worktree support)

### Setup

```bash
bun install
bun run dev
```

Sender/bank data is still browser-local (`localStorage`). Auth state requires D1 + secrets (see below).

### Cloudflare Bindings

Configured in `wrangler.jsonc`:

- **Assets**: static SvelteKit output
- **DB**: D1 database binding (required for auth at runtime)
- **Compatibility**: `nodejs_compat` flag
- Run `bun run cf-typegen` after any `wrangler.jsonc` changes

### Cloudflare Secrets (required for auth)

Set via `wrangler secret put` or in the Cloudflare dashboard:

| Secret                 | Description                                                           |
| ---------------------- | --------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`   | Random secret (e.g. `openssl rand -base64 32`)                        |
| `BETTER_AUTH_URL`      | Deployed URL (e.g. `https://invoice-generator.beyourahi.workers.dev`) |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                                                |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                                            |

`BETTER_AUTH_URL` is also a non-secret binding in `wrangler.jsonc` (exposed to `process.env` for client-side usage). The other three are secrets and must not appear in config files.

Auth is disabled gracefully during local dev if `platform.env.DB` is unavailable (Vite dev server without Wrangler). Use `bun run preview` (Wrangler-backed) to test auth locally.

### Database Migration

Apply migrations per environment:

```bash
bun run db:migrate        # Remote (production)
bun run db:migrate:local  # Local (Wrangler preview)
```

### Clean Rebuild

```bash
rm -rf node_modules/ .wrangler/ .svelte-kit/ && bun install
```

---

## Documentation References (Progressive Disclosure)

When encountering unfamiliar patterns, check in this order:

1. **Svelte 5 docs** — runes (`$state`, `$derived`, `$props`, `$effect`), snippets
2. **SvelteKit docs** — routing, hooks, adapters, `event.platform`
3. **jsPDF docs** — PDF generation API
4. **html2canvas docs** — canvas capture options, `scale`, iframe rendering
5. **fflate docs** — `zipSync`, compression levels, Uint8Array encoding

For extended documentation, create an `agent_docs/` directory at the project root. Store invoice schema specs, theme development guides, or PDF rendering edge cases there.

---

## Project-Specific Warnings

1. **`fixed.init()` is called in `+layout.svelte`'s `onMount`** — `fixed.svelte.ts` reads from `localStorage`. During SSR, `localStorage` is unavailable. The `init()` call lives in the layout's `onMount` so it applies across all pages. Never call it at module scope or in `$effect` on the server, and don't add a second call elsewhere.

2. **PDF generation is sequential and blocking** — `generatePdf()` uses `html2canvas` which paints to canvas synchronously. Running multiple invocations concurrently causes canvas corruption. `GenerationPanel` iterates clients sequentially (`for...of`, awaiting each).

3. **iframe positioning is intentional — do not change it** — `generator.ts` uses `position: fixed; top: -9999px; left: -9999px; visibility: hidden` on the iframe wrapper. The `visibility: hidden` is intentional: it hides the wrapper from the main document while `html2canvas` captures `iframeDoc.body` directly (the iframe's internal document, not the wrapper element). Do not set `display: none` on the iframe or its body — that prevents `html2canvas` from rendering content.

4. **Token substitution is `replaceAll`, not regex** — `resolver.ts` uses `String.prototype.replaceAll`. Tokens like `{MONTH}` will only resolve if the template string contains that exact literal. Case-sensitive.

5. **`allClientsValid` gates generation** — the generate button is disabled unless all clients pass validation. Validation state is `$derived` in `session.svelte.ts`. If generation appears broken, check whether clients have all required fields populated.

6. **`ACTIVE_THEME_ID` is hardcoded** — there is no runtime theme switcher. Changing themes requires updating `ACTIVE_THEME_ID` in `$lib/themes/registry.ts` and rebuilding.

7. **Never commit `tmp_screenshots/` or `.playwright-mcp/`** — these are visual verification artifacts. Clean up before committing.

8. **shadcn-svelte components in `$lib/components/ui/` are auto-generated** — never modify them by hand. Use the CLI to update.

9. **GSAP and formsnap are stale dependencies** — `package.json` lists both `gsap` and `formsnap` but no source file imports either. Safe to remove with `bun remove gsap formsnap`. Do not add new imports for either.

10. **Auth requires D1 at runtime** — `hooks.server.ts` checks for `platform.env.DB`. If D1 is unavailable (e.g. plain Vite dev without Wrangler), auth is silently disabled and all routes treat the user as unauthenticated. Use `bun run preview` (Wrangler-backed) to test auth locally. The PDF pipeline still works without auth.

11. **Do not add email/password auth** — `emailAndPassword` is explicitly disabled in `createAuth`. Google OAuth is the only sign-in method. Adding email/password would require schema changes and is out of scope.

---

## Cross-Codebase Consistency

This project shares conventions with the broader `~/Desktop/projects` ecosystem:

- Same Svelte 5 rune patterns as `corvien`, `nordcycle`, `order-processor`, `beyourahi.com`
- Same Tailwind CSS v4 CSS-first config as all SvelteKit projects
- Same git worktree workflow as all projects in the workspace
- Same Conventional Commits format as all projects
- Same ESLint 9 flat config + Prettier as all projects

If a pattern is unclear here, the most detailed reference implementations are `order-processor/CLAUDE.md` (TypeScript patterns, store design) and `nordcycle/CLAUDE.md` (Svelte 5 + Tailwind conventions).

---

## Frontend UI Visual Verification (REQUIRED)

**During any frontend UI or design work, you MUST use Playwright MCP to visually verify your changes.**

### Workflow

1. **Determine the active port** for this project before taking screenshots (see Port Detection below)
2. **Take screenshots** via Playwright MCP targeting the correct `http://localhost:<port>`
3. **Save to `tmp_screenshots/`** at the root of this repository
4. **Analyze each screenshot** against the plan or requirements to verify accuracy
5. **Iterate** — fix discrepancies, re-screenshot, re-analyze until requirements are met

### Rules

- **ALWAYS** take at least one screenshot per UI change before considering it done
- **NEVER** mark frontend work as complete without visual verification
- Screenshots go in `tmp_screenshots/` at the project root (create the directory if it doesn't exist)
- Name screenshots descriptively: `tmp_screenshots/generation-panel.png`, `tmp_screenshots/client-card-filled.png`
- Take screenshots at multiple viewport sizes when responsive behavior matters (mobile + desktop)
- After each batch of changes, compare the screenshots against the original requirements or design spec and explicitly state what matches and what still needs work
- **MANDATORY CLEANUP**: After every successful task implementation, if the `tmp_screenshots/` directory was created during the work, it must be deleted before the task is considered complete. Do not skip this step — it is a hard requirement.
- **MANDATORY CLEANUP**: After every successful task implementation, if the `.playwright-mcp/` directory exists in the project root, it must be deleted before the task is considered complete. This directory is created by the Playwright MCP server during browser automation and is a transient artifact that must not persist in the codebase. Do not skip this step — it is a hard requirement.

### Port Detection

Multiple dev servers may be running simultaneously across projects. **Always identify the correct port before screenshotting.**

Detection order (use the first that works):

1. **Check dev server output** — the terminal running `bun run dev` prints the active URL (e.g. `Local: http://localhost:5173`)
2. **Check `vite.config.ts`** — look for an explicit `server.port` value
3. **Check `package.json`** — some scripts hardcode a port via `--port` flag
4. **Scan active ports** — run `lsof -i :3000-5999 | grep LISTEN` to see what's bound, then match the process to this project's directory

**Never assume port 3000.** If multiple Vite servers are running, confirm you're screenshotting the right one.

### What to Check in Screenshots

- Two-column grid renders correctly at `lg` breakpoint
- Dark theme renders consistently (no light-mode bleed)
- Spacing, typography, and color tokens are correct
- `FixedSenderPanel`, `ClientCard`, `GenerationPanel` are in expected positions
- Interactive states (hover, focus, expanded cards) render properly
- No layout breaks at mobile viewport

### Commit Message Rules

- **Never include AI agent co-authors** — commit messages must not reference any AI agent (Claude, ChatGPT, Gemini, GitHub Copilot, or similar) in `Co-Authored-By` trailers or any other form.
