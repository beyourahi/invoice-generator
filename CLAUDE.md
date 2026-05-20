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

A SvelteKit app that generates batches of PDF invoices. Users configure a fixed sender identity and payment methods, add multiple clients (each with service details and a list of invoice months), then trigger bulk generation. Each invoice is rendered as HTML, captured via `html2canvas`, and exported to a jsPDF Blob. Multiple PDFs can be downloaded via the File System Access API (directory picker) or, if unavailable, as sequential individual downloads. A ZIP fallback is also available. An optional AI Copilot lets users drive the same client and invoice operations through natural-language commands.

**Stack**: SvelteKit 2 + Svelte 5 runes, Tailwind CSS v4, shadcn-svelte, Cloudflare Workers, Better Auth (Google OAuth), Cloudflare D1, Drizzle ORM, Cloudflare Workers AI, Bun.

**Auth-gated**: Google OAuth via Better Auth. Any authenticated user can access the app. Unauthenticated users are redirected to `/login`. All user data (sender info, payment methods, clients, invoice entries, AI Copilot conversations) is persisted server-side in D1 and loaded on page load. The PDF generation pipeline itself is entirely client-side.

---

## Tech Stack

| Layer           | Technology                                         |
| --------------- | -------------------------------------------------- |
| Framework       | SvelteKit 2.x (Svelte 5 with runes)                |
| Language        | TypeScript (strict mode)                           |
| Styling         | Tailwind CSS v4 (CSS-first config, OKLCH colors)   |
| UI Components   | shadcn-svelte                                      |
| Authentication  | Better Auth (Google OAuth only)                    |
| Database        | Cloudflare D1 (SQLite via Drizzle ORM)             |
| AI              | Cloudflare Workers AI (Llama 4 Scout) + AI Gateway |
| Validation      | Zod                                                |
| PDF Rendering   | html2canvas + jsPDF                                |
| ZIP Packaging   | fflate (`zipSync`, `level: 0`)                     |
| Animations      | None (shadcn Progress + Lucide Loader2 spinner)    |
| Deployment      | Cloudflare Workers                                 |
| Package Manager | Bun                                                |
| Linting         | ESLint 10 flat config + Prettier                   |

---

## Commands

```bash
bun run dev              # Start Vite dev server (--open --host: opens browser, exposes on LAN)
bun run build            # Production build
bun run preview          # Build, then run Wrangler dev (test auth/D1 locally)
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

The server layer handles authentication, data persistence, and AI Copilot inference — the PDF pipeline remains entirely client-side.

- **`$lib/server/auth.ts`** — `createAuth(d1, env)` factory. Returns a Better Auth instance configured with Google OAuth, Drizzle adapter (D1/SQLite), 7-day session expiry, 5-minute cookie cache, and database rate limiting. `env` must include `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

- **`$lib/server/schema.ts`** — Drizzle schema for all tables: Better Auth tables (`users`, `sessions`, `accounts`, `verifications`, `rateLimits`), app tables (`fixedSettings`, `paymentMethods`, `clients`, `clientPaymentMethods`, `invoiceEntries`), and AI Copilot tables (`aiConversations`, `aiMessages`, `aiActions`). Snake_case column names required by the Drizzle adapter.

- **`$lib/server/db.ts`** — `getDatabase(d1)` factory returning a Drizzle instance. Exports `Database` type and `schema`.

- **`$lib/server/api.ts`** — `requireApiContext(event)` → `{ db, userId }`. Throws 401 if unauthenticated, 503 if D1 unavailable. Also exports `parseJson(event, schema)` for Zod-validated request bodies and `ok(data?)` for 200/204 responses.

- **`$lib/server/dto.ts`** — Pure row-to-domain mappers: `toSavedPaymentMethod`, `toInvoiceEntry`, `toClient`, `toFixed`. Also exports `AppState` interface: `{ fixed, clients, selectedClientId, expandedClients }`.

- **`$lib/server/repositories/`** — Seven repository files: `fixed.ts`, `clients.ts`, `payment-methods.ts`, `state.ts`, `ai-conversations.ts`, `ai-messages.ts`, `ai-actions.ts`. `state.ts` exports `loadAppState(db, userId)` → `AppState` used in `+page.server.ts`.

- **`$lib/server/validation.ts`** — Shared Zod schemas for API request bodies.

- **`$lib/auth-client.ts`** — Better Auth Svelte client (`createAuthClient`). Exports `authClient`, `signIn`, `signOut`, `useSession`.

- **`$lib/config/app.ts`** — `APP_CONFIG` object. App metadata used for `<title>` and `<meta>` tags.

- **`$lib/hooks/use-current-user.ts`** — `getCurrentUser(user)` → `CurrentUser | null`.

- **`src/hooks.server.ts`** — SvelteKit `handle` hook. Instantiates `createAuth` per request, delegates Better Auth routes to `svelteKitHandler`, calls `auth.api.getSession`, populates `event.locals.user`, `event.locals.session`, `event.locals.currentUser`. Applies CSP and security headers on every response. Gracefully degrades if D1 unavailable. Exports `handleError` with UUID correlation.

- **`src/hooks.client.ts`** — Client-side `handleError` with UUID correlation.

- **`src/routes/+layout.server.ts`** — Passes `user`, `session`, `currentUser` from `locals`, plus the `aiEnabled` flag (derived from the `AI_COPILOT_ENABLED` var), into `PageData`.

- **`src/routes/+page.server.ts`** — Redirects to `/login` if unauthenticated. Loads full `AppState` from D1 via `loadAppState` and the AI Copilot hydration payload (conversations, messages, actions, anomaly settings), returning them alongside `user` and `currentUser`.

- **`src/routes/login/+page.svelte`** — Google sign-in button. Redirects to `/` after successful OAuth.

- **`src/routes/login/+page.server.ts`** — Redirects to `/` if already authenticated.

- **`src/routes/api/logout/+server.ts`** — `POST`/`GET` both delete the session cookie and redirect to `/login`.

- **`src/routes/api/fixed/+server.ts`** — `PATCH` updates sender fields; `PUT` updates `selectedClientId`.

- **`src/routes/api/payment-methods/+server.ts`** and **`[id]/+server.ts`** — CRUD for payment methods. `PUT` reorders by `orderedIds` array.

- **`src/routes/api/clients/+server.ts`** and **`[id]/+server.ts`** — CRUD for clients. `POST` accepts optional `templateId` to copy from an existing client.

- **`src/routes/api/clients/[id]/entries/+server.ts`** and **`[entryId]/+server.ts`** — CRUD for invoice entries per client.

- **`src/routes/api/clients/[id]/payment-methods/+server.ts`** — `PUT` updates the ordered list of payment method IDs for a client.

- **`src/routes/api/ai/`** — AI Copilot endpoints: `chat/+server.ts` (SSE streaming turn), `conversations/+server.ts` and `[id]/+server.ts` (conversation CRUD), `messages/+server.ts` (message list), `actions/+server.ts` and `[id]/+server.ts` (action history), `undo/[id]/+server.ts` (reverse an applied action). See the AI Copilot section.

**Authorization flow**: Google OAuth → any authenticated user gains full access. All data is scoped to `userId`.

### API Client

**`$lib/api/client.ts`** — Typed fetch wrapper: `api.get`, `api.post`, `api.patch`, `api.put`, `api.delete`. Also exports `sync(fn)` (try/catch wrapper returning `T | null`) and `debounceSync(key, delayMs, fn)` (debounced fire-and-forget used for text fields).

### Store Design

All three stores use the **factory function + `$state` closure** pattern, exported as singletons. Mutations call the API client to persist changes server-side.

- **`$lib/stores/session.svelte.ts`** — Per-session state: `clients`, `selectedClientId`, `expandedClients`, `generatedInvoices`, `generationState`, `generationError`. Client mutations: `addClient`, `removeClient`, `updateClient(id, patch)`, `togglePaymentMethod`, `ensurePaymentMethodSelected`, `purgePaymentMethodFromClients`, `addInvoiceEntry`, `addInvoiceEntries(clientId, months[])`, `removeInvoiceEntry`, `updateInvoiceEntry`. Activation toggles: `setClientActive(id, isActive)`, `setInvoiceActive(clientId, entryId, isActive)` — both capture previous state and roll back on API failure so stale `isActive` flags cannot leak into the generation queue. Selection/expansion: `setSelectedClientId`, `setClientExpanded`, `toggleClientExpanded`, `isClientExpanded`. Generation lifecycle: `setGenerating`, `setGenerated`, `setError`, `resetGeneration`. Three `$derived` values: `totalInvoiceCount`, `generatableInvoiceCount` (count after active filter), and `allClientsValid` (checks every client has non-empty `name` and `invoicePrefix`). Has a `hydrate(initial)` method called once in `+page.svelte` via `untrack` to seed from server data.

- **`$lib/stores/fixed.svelte.ts`** — Sender/bank data synced to D1. Exposes `value` getter, `hydrate(initial)`, `updateFrom(field, value)`, `addPaymentMethod(kind)`, `removePaymentMethod(id)`, `updatePaymentMethodLabel`, `updatePaymentMethodValue`, `movePaymentMethod`. All mutations call the API. Text mutations are debounced via `debounceSync`. Has a `hydrate(initial)` method called once in `+page.svelte` via `untrack`.

- **`$lib/stores/ai.svelte.ts`** — AI Copilot state: conversations, messages, streaming status, the Tier-B confirmation queue, undo history, anomaly settings (persisted to `localStorage`), and mobile/tab UI state. Has a `hydrate(payload)` method called once in `+page.svelte` via `untrack`. Detailed in the AI Copilot section.

The factory pattern is required because Svelte 5 `$state` reactivity is scoped to its declaration.

### Payment Methods System

**`$lib/payments/registry.ts`** — Defines all supported payment method types as `PAYMENT_METHOD_DEFS: Record<PaymentMethodKind, PaymentMethodDef>`. Supported kinds: `bank`, `bkash`, `nagad`, `rocket`, `wise`, `payoneer`, `paypal`, `custom`. Each `PaymentMethodDef` has `display: "fields" | "link"`. Link methods (wise, payoneer, paypal) show a payment link button in the PDF. Field methods (bank, mobile wallets, custom) show labeled key-value rows. Exports `getMethodDef`, `createSavedMethod`, `isMethodComplete`.

Currencies: `BDT` and `USD`. `$lib/format/currency.ts` exports `formatAmount` and `currencySymbol`.

### Invoice Pipeline

1. **`$lib/invoice/active.ts`** — Single source of truth for the active filter. Exports `getGeneratableInvoices(clients)`, `countGeneratableInvoices(clients)`, and `firstGeneratableInvoice(client)`. Filter rule: `client.isActive AND entry.isActive` (strict AND gate). All generation paths (`GenerationPanel`, `InvoicePreview`, store derived count) consume these helpers — no caller iterates raw `session.clients` for generation.

2. **`$lib/invoice/builder.ts`** — `buildInvoiceHtml(client, entry, fixed, theme)` assembles a complete HTML document string. `renderPaymentMethod` uses the payment method's `display` style to select the correct theme template. Invoice ID format: `{PREFIX}-{MM}{ISSUE_DAY}-{YEAR}` (e.g. `ACME-0101-2026`). Service description supports a `{MONTH}` token substituted via `String.prototype.replace`. Exports `getInvoiceId(client, entry)` and `getFileName(client, entry)` → `invoice-{PREFIX}-{MM}{ISSUE_DAY}-{YEAR}.pdf`.

3. **`$lib/invoice/resolver.ts`** — Single pure function: string template + token map → resolved string via `replaceAll`.

4. **`$lib/invoice/months.ts`** — `MONTHS` array and `MONTH_TO_NUMBER` map (`"January" → "01"`, etc.).

5. **`$lib/pdf/generator.ts`** — Entirely client-side. Injects HTML into a hidden off-screen `<iframe>`, waits for fonts, runs `html2canvas` at 2× scale on the iframe body (A4: 794×1123px), writes the canvas to jsPDF at 210×297mm. Returns a `Blob`.

6. **`$lib/pdf/sequential-download.ts`** — `downloadGroups(groups)` → `DownloadResult`. Tries the File System Access API (`showDirectoryPicker`) first; falls back to sequential individual downloads with 150ms delay between files. Returns `{ usedDirectoryPicker, fellBackToSequential, cancelled, fileCount }`. Files are organized under an `invoices/` root; clients with more than one invoice get a subfolder named `{ClientName}-{Year}-Invoices`. Exports `DownloadGroup`, `DownloadResult`, `countFiles`, `downloadGroups`, `isUserAbort`.

7. **`$lib/pdf/zip.ts`** — `downloadInvoicesZip(groups)` — ZIP fallback using `fflate`. Builds the same folder structure as the directory picker and triggers a single `invoices.zip` download.

### Theme System

**`$lib/themes/registry.ts`** maps `ThemeId` → `Theme`. A `Theme` contains: `html` (full document template), `css` (minified stylesheet injected into `{CSS}`), `paymentMethodFields` (partial template for field-style methods), `paymentMethodLink` (partial template for link-style methods), and `paymentField` (partial template for a single field row). Theme definitions live in their own files (`$lib/themes/default.ts`); `registry.ts` imports and registers them. Only one theme exists: `default`. `ACTIVE_THEME_ID` is the hardcoded active theme.

To add a theme: create a new file in `$lib/themes/` implementing the full `Theme` interface, register it in `themes` in `registry.ts`, and update `ThemeId`.

### UI Layout

**App layout** — two-column grid at `lg` breakpoint; collapses to single column with a togglable preview panel on mobile (grid-rows animation).

- **`User`** (`src/components/User.svelte`) — top-right avatar. Desktop: hover tooltip; mobile: tap opens a `Dialog`. Both surface the sign-out action.
- **`Heading`** (`$lib/components/ui/heading/heading.svelte`) — shared heading above the grid.
- **Left column** — `FixedSenderPanel` + `ClientCard` list + `AddClientButton`.
- **Right column** (sticky on desktop, collapsible on mobile) — `RightRailTabs`, a Preview/AI tab switcher wrapping `InvoicePreview` (live scaled iframe of the selected/first client's first generatable invoice) and `AiSidebar` (AI Copilot chat).
- **Below grid** (full-width) — `GenerationPanel`.

`GenerationPanel` owns the generate loop: iterates the queue from `getGeneratableInvoices(session.clients)` (active-only), calls `buildInvoiceHtml` + `generatePdf` sequentially, tracks progress with `$state<number>` (0–100) bound to a shadcn `Progress`. On completion renders a `Table` of results with per-client download (directory picker or sequential) and ZIP buttons. Uses `svelte-sonner` toasts for success/error feedback.

**`src/components/MonthPickerDialog.svelte`** — Dialog-based multi-month picker for adding invoice entries (multiple months at once). Opened from `ClientCard` to add entries.

**`src/components/SelectDialog.svelte`** — Generic dialog-based single-item picker used in place of native `<select>` elements.

**`src/components/OverflowActions.svelte`** — Mobile-only sheet that replaces inline action icon buttons on `ClientCard` and `PaymentMethodCard` at small breakpoints. Desktop renders the actions inline.

**`src/components/StatusBadge.svelte`** — Reusable active/inactive badge driven by semantic status color tokens (`--color-status-active`, `--color-status-inactive` in `src/app.css`). Inactive clients/entries also render a subtle left accent bar rather than opacity-only dimming.

**`src/components/InvoiceEntryRow.svelte`** — A single invoice entry row. Table layout at `sm+`, card layout on mobile. Includes the active `Switch` toggle.

**`src/components/PaymentMethodCard.svelte`** — Card UI for configuring a single payment method's fields.

**`src/components/AddClientButton.svelte`** — Button that creates a new client entry; shown below the `ClientCard` list.

**`src/components/SectionEyebrow.svelte`** — Small label/eyebrow text rendered above section headings.

### InvoicePreview

`src/components/InvoicePreview.svelte` renders a live scaled preview of the first generatable entry (via `firstGeneratableInvoice(client)`) for the selected client. Uses `srcdoc={html}` on an iframe, derives a CSS scale factor from container width (`containerWidth / 794`) via a Svelte action backed by a `ResizeObserver`. Selected client is `session.selectedClientId` (falling back to `session.clients[0]`). Contextual empty states distinguish no-client, no-entries, and no-active scenarios.

### Toast Notifications

`svelte-sonner` via shadcn `sonner` component. The `Toaster` component is lazy-imported in `onMount` in `+page.svelte`. Individual toasts are fired via dynamic `import("svelte-sonner")` inside async handlers in `GenerationPanel`.

### Server-side Data Hydration

`+page.server.ts` loads full `AppState` (fixed settings + payment methods + clients + invoice entries + selected/expanded state) from D1 via `loadAppState(db, userId)`. `+page.svelte` calls `fixed.hydrate(data.appState.fixed)`, `session.hydrate(...)`, and `ai.hydrate(data.ai)` inside `untrack()` to seed the stores without triggering reactive side effects.

### AI Copilot

An optional natural-language assistant for managing clients, invoices, and payment methods. The server runs model inference; tool execution happens client-side against the same REST API as the manual UI. Gated by the `AI_COPILOT_ENABLED` var (set to `"false"` to disable).

- **`$lib/ai/`** — Client-side AI layer:
  - `types.ts` — shared types: `Frame`, tool-call shapes, `InverseRecord`, `AnomalyResult`, `SafetyTier`.
  - `client.ts` — `runChatFrames()` calls the Workers AI binding (`@cf/meta/llama-4-scout-17b-16e-instruct`, temperature 0.2), optionally routed through AI Gateway via `AI_GATEWAY_SLUG`.
  - `streaming.ts` — SSE frame encode/decode (`encodeFrame`, `decodeFrame`, `streamFrames`, `sseStream`).
  - `context.ts` — `projectAppState(appState)` serializes current state into a tokenized (`cli_1`, `ent_1`, `pm_1`) prompt context.
  - `prompts.ts` — system prompt builder (`buildSystemContext`); prompt version `v1`.
  - `tools-catalog.ts` — `TOOLS_CATALOG`: 19 tools, each tagged Tier A (auto-apply) or Tier B (destructive/money-mutating — requires confirmation).
  - `schemas.ts` — per-tool Zod arg schemas (`argSchemas`, `ArgsOf`). Server-safe (no DOM/store imports) so `chat/+server.ts` shares them with `tools.ts`.
  - `tools.ts` — per-tool executors; each validates args via `argSchemas`, calls the REST API, and returns `{ inverse, summary }`.
  - `executor.ts` — `executeToolCall()`: validates args, resolves the safety tier, runs anomaly detection, requests confirmation for Tier B, records the action, executes.
  - `safety.ts` — `detectAnomalies()`: five non-blocking detectors (amount outlier, volume surge, missing payment methods, stale period, currency mismatch).
  - `inverse.ts` — builds an `InverseRecord` (reverse tool call + optional snapshot) for every executed tool, enabling undo.
  - `markdown.ts` — minimal AST-based markdown parser; renders AI message text in `AiMessage.svelte` (no markdown library).
  - `chat-client.ts` — `sendMessage`, `triggerUndo`, conversation CRUD, confirmation responses.
- **`$lib/server/`** — AI server layer:
  - `ai-quota.ts` — `checkAndIncrementQuota(kv, userId)`: per-user daily turn limit (default 200) tracked in `AI_QUOTA_KV`; disabled when the KV binding is absent.
  - `ai-spend.ts` — `checkSpendCap` / `recordSpend` / `estimateTurnCostUsd`: per-user monthly USD spend cap (default $1.00, override via `AI_MONTHLY_CAP_USD`) tracked in `AI_QUOTA_KV`; disabled when the KV binding is absent.
  - `ai-undo.ts` — `applyInverse(db, userId, inverse)`: server-side reversal of an action; throws `UndoInvalidatedError` if the target no longer exists.
  - `log.ts` — `logChatTurn` / `logToolExecution`: structured stdout logging with hashed user IDs.
  - `repositories/ai-conversations.ts`, `ai-messages.ts`, `ai-actions.ts` — D1 persistence for the three AI tables.
- **`$lib/stores/ai.svelte.ts`** — the `ai` store (see Store Design).
- **`src/components/ai/`** — `AiSidebar`, `AiMessage`, `AiToolBadge`, `AiConfirmDialog`, `AiAnomalyWarning`, `AiSettingsDialog`, `AiConversationsPanel`, `AiMobileFab`, `AiMobileSheet`. `AiSidebar` has a single collapsible `History` tab that toggles `AiConversationsPanel` (the list of past conversations, with `New chat`) above the persistent chat thread. A `<svelte:boundary>` wraps the message list so a render error degrades to an inline retry rather than crashing the pane. There is no action-log panel — undo for applied actions stays available via per-action toasts and inline `AiToolBadge` controls.

**Data flow**: user message → `POST /api/ai/chat` (loads context, runs the model, streams frames) → client parses frames and runs each tool via `executeToolCall` → Tier B tools wait for `AiConfirmDialog` approval → applied actions are recorded and reversible via `POST /api/ai/undo/[id]`.

---

## Development Principles

- **PDF pipeline is client-side only** — `builder.ts`, `generator.ts`, `zip.ts`, `sequential-download.ts`, and all stores run in the browser. Server files handle auth, data persistence, and AI Copilot inference.
- **Prefer existing abstractions** — check `$lib/` before creating new utilities.
- **No duplication** — use `resolver.ts` for token substitution; use `api` client for all fetch calls.
- **Minimal scope** — no animation library. Use shadcn `Progress`, `Skeleton`, and Lucide `Loader2`. Don't add GSAP or other animation libraries.
- **Performance** — PDF generation is blocking by design. Each `generatePdf()` call is sequential. Do not parallelize.
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

### TypeScript

- Strict mode. No `any`. No loose casts.
- `import type { ... }` for type-only imports
- All component prop types defined explicitly
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
- Design is **dark-only**. No light mode.

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
- **No assumptions** — verify the invoice pipeline, store signatures, and theme structure before modifying them.
- **Prefer existing abstractions** — `resolver.ts` for token substitution; `api` client for all fetch calls; `requireApiContext` for API route auth.
- **No scope creep** — a bug fix does not need surrounding cleanup.
- **Validate Svelte code** — run `svelte-autofixer` (svelte MCP) before delivering any `.svelte` file changes.
- **Validate before committing** — run `bun run check` and `bun run lint` before every commit. Never commit failing builds.
- **No feature flags** — this is a single-user tool.
- **No backwards-compat shims** — if you change a store shape or API contract, update all callers.

---

## MCP & Tooling Usage

Consult MCP tools in this priority order:

1. **`svelte` MCP** — for any Svelte 5 or SvelteKit code
   - `list-sections` → discover doc sections
   - `get-documentation` → fetch relevant sections
   - `svelte-autofixer` → **mandatory** before delivering Svelte code
2. **`context7` MCP** — for Tailwind CSS v4, shadcn-svelte, jsPDF, html2canvas, fflate, svelte-sonner, Drizzle ORM, Better Auth
3. **Web search** — last resort

Never use `shopify-dev` MCP (this is not a Shopify project).

---

## Testing Practices

No test framework is currently configured. Validation is done through:

- `bun run check` — svelte-check with strict TypeScript
- `bun run lint` — Prettier formatting + ESLint rules
- Manual testing: generate PDFs, verify file names, test directory picker and ZIP fallback, test with multiple clients and months

When adding tests:

- Use Vitest (compatible with the Vite setup)
- Priority test targets: `resolver.ts`, `builder.ts` (invoice ID format), `sequential-download.ts` (group logic), `dto.ts` (row mappers)
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

Auth state and all user data require D1 + secrets (see below). Without D1, auth is disabled and all routes treat the user as unauthenticated — the PDF pipeline still works if you bypass auth guards.

### Cloudflare Bindings

Configured in `wrangler.jsonc`:

- **ASSETS**: static SvelteKit output
- **DB**: D1 database binding (required for auth and data at runtime)
- **AI**: Workers AI binding (required for the AI Copilot)
- **AI_QUOTA_KV**: KV namespace backing the AI Copilot per-user daily turn quota and monthly USD spend cap (optional — both disabled if absent)
- **vars**: `BETTER_AUTH_URL`, `AI_GATEWAY_SLUG` (AI Gateway route), `AI_COPILOT_ENABLED` (feature flag), `AI_MONTHLY_CAP_USD` (monthly AI spend cap, USD)
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

`BETTER_AUTH_URL` is also a non-secret binding in `wrangler.jsonc`. The other three are secrets — never commit them.

Use `bun run preview` (Wrangler-backed) to test auth locally.

### Database Migration

```bash
bun run db:migrate        # Remote (production)
bun run db:migrate:local  # Local (Wrangler preview)
```

Four migrations exist: `0001_better_auth_tables.sql` (Better Auth tables), `0002_daffy_synch.sql` (app tables: clients, invoice_entries, payment_methods, etc.), `0003_cute_vision.sql` (additive `is_active` columns on `clients` and `invoice_entries` with `DEFAULT true NOT NULL`), and `0004_marvelous_puck.sql` (AI Copilot tables: `ai_conversations`, `ai_messages`, `ai_actions`).

### Clean Rebuild

```bash
rm -rf node_modules/ .wrangler/ .svelte-kit/ && bun install
```

---

## Documentation References

When encountering unfamiliar patterns, check in this order:

1. **Svelte 5 docs** — runes, snippets
2. **SvelteKit docs** — routing, hooks, adapters, `event.platform`
3. **Better Auth docs** — session management, OAuth, Drizzle adapter
4. **Drizzle ORM docs** — D1 adapter, query builder
5. **jsPDF docs** — PDF generation API
6. **html2canvas docs** — canvas capture options, `scale`, iframe rendering
7. **fflate docs** — `zipSync`, compression levels

---

## Project-Specific Warnings

1. **Store hydration uses `untrack`** — `+page.svelte` calls `fixed.hydrate()` and `session.hydrate()` inside `untrack()`. This prevents triggering reactive side effects during initialization. Do not add a second hydrate call anywhere else.

2. **PDF generation is sequential and blocking** — `generatePdf()` uses `html2canvas` which paints to canvas synchronously. Do not parallelize; `GenerationPanel` iterates sequentially via `for...of`, awaiting each.

3. **iframe positioning is intentional — do not change it** — `generator.ts` uses `position: fixed; top: -9999px; left: -9999px; visibility: hidden` on the iframe wrapper. `visibility: hidden` is intentional: it hides the wrapper while `html2canvas` captures `iframeDoc.body` directly. Do not use `display: none` on the iframe or its body — that prevents `html2canvas` from rendering content.

4. **Token substitution is `replaceAll`, not regex** — `resolver.ts` uses `String.prototype.replaceAll`. Tokens like `{MONTH}` only resolve if the exact literal is present. Case-sensitive.

5. **`allClientsValid` gates generation** — the generate button is disabled unless all clients have `name` and `invoicePrefix`. If generation appears broken, check client validation state.

6. **`ACTIVE_THEME_ID` is hardcoded** — no runtime theme switcher. Changing themes requires updating `ACTIVE_THEME_ID` in `$lib/themes/registry.ts` and rebuilding.

7. **Never commit `tmp_screenshots/` or `.playwright-mcp/`** — visual verification artifacts. Clean up before committing.

8. **shadcn-svelte components in `$lib/components/ui/` are auto-generated** — never modify them by hand. Use the CLI to update.

9. **Auth requires D1 at runtime** — if D1 is unavailable (plain Vite dev without Wrangler), auth is silently disabled and all routes treat the user as unauthenticated. Use `bun run preview` to test auth locally.

10. **Do not add email/password auth** — `emailAndPassword` is explicitly disabled in `createAuth`. Google OAuth is the only sign-in method.

11. **Payment methods are stored in D1, not localStorage** — `fixed.svelte.ts` no longer reads from `localStorage`. All mutations call the REST API. The `hydrate()` method seeds the store from server-loaded data at page load.

12. **API routes require D1** — `requireApiContext` throws 503 if `platform.env.DB` is unavailable. All `/api/*` routes will fail in plain Vite dev without Wrangler.

13. **html2canvas ignores UA stylesheet overrides on `<a>` elements** — anchor tags get browser-default link colors that persist even with `!important`, inline styles, or `element.style.setProperty()`. Never use `<a>` in PDF templates. Use `div[data-href]` instead; `generator.ts` queries `[data-href]` to build jsPDF link annotations via `pdf.link()`.

14. **Use inline SVG for PDF buttons, not HTML/CSS** — html2canvas CSS cascade is unreliable for button-like elements. The default theme's `paymentMethodLink` renders the payment button as an inline `<svg>` with `fill="#ffffff"` on SVG `<text>`, bypassing the cascade entirely. Do not replace with HTML/CSS.

15. **Generation queue must come from `active.ts`** — never iterate `session.clients → client.invoices` directly for generation. Use `getGeneratableInvoices()` / `firstGeneratableInvoice()` / `countGeneratableInvoices()` from `$lib/invoice/active.ts`. The active filter is a strict AND gate (`client.isActive AND entry.isActive`); deactivating a client cascades to its entries via UI disable + tooltip.

16. **Active toggles use optimistic updates with rollback** — `setClientActive` and `setInvoiceActive` capture the previous `isActive` value, mutate locally, then call the API. On failure they restore the prior state. Do not add a separate "saving" flag; the rollback path is the contract.

17. **AI Copilot is gated by `AI_COPILOT_ENABLED`** — setting the var to `"false"` disables the feature in `+layout.server.ts` and `+page.server.ts`. The `AI` binding is required when enabled; `AI_QUOTA_KV` is optional (daily quota and monthly spend cap are skipped if absent).

18. **Every AI tool must produce an inverse** — each executor in `$lib/ai/tools.ts` returns an `InverseRecord` so the action can be reversed via `applyInverse`. When adding or changing a tool, update its inverse in `$lib/ai/inverse.ts` in lockstep, or undo will silently break.

---

## Cross-Codebase Consistency

This project shares conventions with the broader `~/Desktop/projects` ecosystem:

- Same Svelte 5 rune patterns as `corvien`, `nordcycle`, `order-processor`, `beyourahi.com`
- Same Tailwind CSS v4 CSS-first config as all SvelteKit projects
- Same git worktree workflow as all projects in the workspace
- Same Conventional Commits format as all projects
- Same ESLint flat config + Prettier as all projects

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
