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

A client-side-only SvelteKit app that generates batches of PDF invoices. Users configure a fixed sender identity, add multiple clients (each with service details and a list of invoice months), then trigger bulk generation. Each invoice is rendered as HTML, captured via `html2canvas`, and exported to a jsPDF Blob. Multiple PDFs can be downloaded individually or zipped together via `fflate`.

**Stack**: SvelteKit 2 + Svelte 5 runes, Tailwind CSS v4, shadcn-svelte, Cloudflare Workers (static hosting), Bun.

**No server-side rendering. No database. No auth.** Everything runs in the browser.

---

## Tech Stack

| Layer           | Technology                                       |
| --------------- | ------------------------------------------------ |
| Framework       | SvelteKit 2.x (Svelte 5 with runes)              |
| Language        | TypeScript (strict mode)                         |
| Styling         | Tailwind CSS v4 (CSS-first config, OKLCH colors) |
| UI Components   | shadcn-svelte                                    |
| PDF Rendering   | html2canvas + jsPDF                              |
| ZIP Packaging   | fflate (`zipSync`, `level: 0`)                   |
| Animations      | GSAP (entrance only)                             |
| Deployment      | Cloudflare Workers (static assets)               |
| Package Manager | Bun                                              |
| Linting         | ESLint 9 flat config + Prettier                  |

---

## Commands

```bash
bun run dev        # Dev server
bun run build      # Production build
bun run preview    # Preview via Wrangler (requires build first)
bun run check      # svelte-check TypeScript validation
bun run lint       # ESLint
bun run format     # Prettier
bun run cf-typegen # Regenerate worker-configuration.d.ts from wrangler.jsonc
```

---

## Architecture

### Path Aliases

Two aliases are configured in `svelte.config.js`:

- `$lib` → `src/lib/` (SvelteKit default)
- `$src` → `src/` (custom, used in route files to import from `src/components/`)

Route files use `$src/components/...`; library files use `$lib/...`. Never use relative paths.

### Store Design

Both stores use the **factory function + `$state` closure** pattern, exported as singletons:

- **`$lib/stores/session.svelte.ts`** — Ephemeral per-session state: the `clients` array, `generatedInvoices`, `generationState` (`"idle" | "generating" | "done" | "error"`), and `generationError`. Client mutations are exposed as discrete methods: `addClient`, `removeClient`, `updateClient(id, updater)`, `addInvoiceEntry`, `removeInvoiceEntry`, `updateInvoiceEntry`. Generation lifecycle methods: `setGenerating`, `setGenerated`, `setError`, `resetGeneration`. Two `$derived` computed values: `totalInvoiceCount` and `allClientsValid` — the latter checks that every client has a non-empty `name` and `invoicePrefix` (those two fields only).

- **`$lib/stores/fixed.svelte.ts`** — Persistent sender/bank data, stored in `localStorage` under key `invoice-generator:fixed`. Has a lazy `init()` method that must be called in an `onMount` (SSR guard) before reads are meaningful.

The factory pattern is required because Svelte 5 `$state` reactivity is scoped to its declaration; returning objects with explicit `get` accessors exposes the reactive values outside the module.

### Invoice Pipeline

1. **`$lib/invoice/builder.ts`** — `buildInvoiceHtml(client, entry, fixed, theme)` assembles a complete HTML document string. Calls `resolveTokens` to substitute `{TOKEN}` placeholders. Invoice ID format: `{PREFIX}-{MM}{DD}-{YEAR}` (e.g. `ACME-0101-2026`). Service description supports a `{MONTH}` token (substituted via `String.prototype.replace`, not `resolveTokens`). Also exports three pure helpers used by `GenerationPanel`: `getInvoiceId(client, entry)`, `getFileName(client, entry)` → `invoice-{PREFIX}-{MM}{DD}-{YEAR}.pdf`, and `getFolderName(client)` → `{ClientName}-{Year}-Invoices`.

2. **`$lib/invoice/resolver.ts`** — Single pure function: string template + token map → resolved string via `replaceAll`.

3. **`$lib/pdf/generator.ts`** — Entirely client-side. Injects the HTML into a hidden off-screen `<iframe>`, waits for fonts, runs `html2canvas` at 2× scale on the iframe body (A4: 794×1123px), then writes the canvas to a jsPDF at 210×297mm. Returns a `Blob`.

4. **`$lib/pdf/zip.ts`** — Collects all `GeneratedInvoice` Blobs into a `fflate` `zipSync` with paths `{ClientName}-{Year}-Invoices/{fileName}.pdf`. `level: 0` (store-only, no compression) since PDFs are already compressed.

### Theme System

`$lib/themes/registry.ts` maps `ThemeId` → `Theme`. A `Theme` contains four strings: `html` (full document template), `css` (minified stylesheet injected into `{CSS}`), `bankPayment`, and `wisePayment` (partial HTML for the payment section). Only one theme exists: `default`. `ACTIVE_THEME_ID` is the hardcoded active theme.

To add a theme: implement the `Theme` interface in a new file, register it in `themes` in `registry.ts`, and update `ThemeId`.

### UI Layout

Single-page, three-column grid at `lg` breakpoint:

- **Left aside** — `FixedSenderPanel` (sender identity + bank details, persists to localStorage)
- **Center** — `ClientCard` list + `AddClientButton` (ephemeral session state)
- **Right aside** (sticky) — `DownloadPanel` (visible only after generation) + `GenerationPanel`

`GenerationPanel` owns the generate loop: iterates `session.clients → client.invoices`, calls `buildInvoiceHtml` + `generatePdf` sequentially (each PDF render is async/blocking), updates progress via GSAP counter animation.

### Animations

GSAP is used for entrance animations only (header stagger, card mount, download panel reveal, generation counter). No scroll triggers or complex timelines.

---

## Development Principles

- **Client-side only** — no server actions, no API routes, no backend. Everything runs in the browser.
- **Prefer existing abstractions** — check `$lib/` before creating new utilities.
- **No duplication** — if logic exists in `resolver.ts`, use it; don't inline token-substitution calls elsewhere.
- **Minimal scope** — GSAP for entrance animations only. Don't introduce scroll-triggered animations or complex timelines.
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
2. **`context7` MCP** — for Tailwind CSS v4, shadcn-svelte, jsPDF, html2canvas, fflate, GSAP
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

No environment variables required. All state is browser-local (localStorage for fixed store).

### Cloudflare Bindings

Configured in `wrangler.jsonc`:

- **Assets**: static SvelteKit output
- **Compatibility**: `nodejs_compat` flag
- Run `bun run cf-typegen` after any `wrangler.jsonc` changes

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

1. **`fixed.init()` must be called in `onMount`** — `fixed.svelte.ts` reads from `localStorage`. During SSR, `localStorage` is unavailable. The `init()` call is guarded by `onMount`. Never call it at module scope or in `$effect` on the server.

2. **PDF generation is sequential and blocking** — `generatePdf()` uses `html2canvas` which paints to canvas synchronously. Running multiple invocations concurrently causes canvas corruption. `GenerationPanel` iterates clients sequentially (`for...of`, awaiting each).

3. **iframe positioning is intentional — do not change it** — `generator.ts` uses `position: fixed; top: -9999px; left: -9999px; visibility: hidden` on the iframe wrapper. The `visibility: hidden` is intentional: it hides the wrapper from the main document while `html2canvas` captures `iframeDoc.body` directly (the iframe's internal document, not the wrapper element). Do not set `display: none` on the iframe or its body — that prevents `html2canvas` from rendering content.

4. **Token substitution is `replaceAll`, not regex** — `resolver.ts` uses `String.prototype.replaceAll`. Tokens like `{MONTH}` will only resolve if the template string contains that exact literal. Case-sensitive.

5. **`allClientsValid` gates generation** — the generate button is disabled unless all clients pass validation. Validation state is `$derived` in `session.svelte.ts`. If generation appears broken, check whether clients have all required fields populated.

6. **`ACTIVE_THEME_ID` is hardcoded** — there is no runtime theme switcher. Changing themes requires updating `ACTIVE_THEME_ID` in `$lib/themes/registry.ts` and rebuilding.

7. **Never commit `tmp_screenshots/` or `.playwright-mcp/`** — these are visual verification artifacts. Clean up before committing.

8. **shadcn-svelte components in `$lib/components/ui/` are auto-generated** — never modify them by hand. Use the CLI to update.

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

- Three-column grid renders correctly at `lg` breakpoint
- Dark theme renders consistently (no light-mode bleed)
- Spacing, typography, and color tokens are correct
- `FixedSenderPanel`, `ClientCard`, `GenerationPanel` are in expected positions
- Interactive states (hover, focus, expanded cards) render properly
- No layout breaks at mobile viewport
