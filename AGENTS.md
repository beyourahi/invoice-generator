# Invoice Generator

SvelteKit 5/Cloudflare Workers invoice tool with Better Auth, D1/Drizzle, guest persistence, payment methods, PDF/invoice rendering, an AI copilot, and the vendored Dropout design system. Bun is the package manager.

## Binding workflow

- Work only on `main`; use isolated worktrees for concurrent work.
- Follow workspace git gates, autonomy, deployment, frontend-design, browser verification, and mandatory Swiss Design rules.
- Pushes auto-deploy through Cloudflare Workers Builds; never run routine manual deploys.
- Vendored DS lives in `src/lib/ds/`; refresh with `dropout-ds-sync`, never hand-edit it.
- Generated shadcn components must not be hand-edited. Tailwind v4 is CSS-first.
- Use Svelte 5 runes, strict TypeScript, and `$lib` aliases.

## Architecture and safety

- Preserve authenticated server persistence and isolated guest persistence; never cross user or guest ownership boundaries.
- Treat invoice/customer data, payment details, credentials, AI keys, and exported documents as private.
- Validate invoice values, currency, totals, taxes/discounts, payment methods, uploaded assets, and API inputs at trust boundaries.
- Keep auth, CSRF, rate limits, and D1 access fail closed.
- Database schema changes require generated migrations plus local and remote migration verification.
- Local auth bypass requires both the gitignored flag and localhost host; never deploy it.

## Verification

Use `bun run format`, `bun run lint`, `bun run check`, targeted tests, and a representative invoice render/export check when the invoice pipeline changes.

## Conditional reference

Read the project skill `invoice-generator-reference` before changing invoice architecture, auth, persistence, payment methods, AI copilot, tooling, migrations, testing, or operations. It preserves the detailed architecture, commands, setup, and warnings.
