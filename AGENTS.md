# AGENTS.md

Multi-agent execution framework for the invoice-generator codebase. Read `CLAUDE.md` first — this file defines how agents divide and coordinate work, not how to operate within the codebase.

---

## Agent System Overview

This project uses a **parallel worktree model**: each agent gets its own git worktree so agents can make independent changes simultaneously without conflicts. An orchestrating agent (or the user) decomposes tasks, assigns scopes, and merges results after validation.

Agents communicate through:

- The shared codebase (read-only access to files outside their worktree scope)
- This file and `CLAUDE.md` as the shared contract
- Explicit task boundaries passed in the agent prompt

**Default model**: `claude-sonnet-4-6`. Use `claude-opus-4-7` only for orchestration or architectural decisions.

---

## Worktree Setup (Universal)

```bash
# Orchestrator creates a worktree per agent scope
git worktree add ../invoice-generator-<scope>

# After agent completes its scope
git worktree remove ../invoice-generator-<scope>
git worktree prune
```

Each worktree shares the same repository. Agents commit directly to their worktree's checkout of `main`. The orchestrator reviews and cherry-picks or merges sequentially.

---

## Agent Roles

### Architecture Agent

**Responsibility**: System design, store shape, pipeline contracts, file structure decisions.

**Triggers**: New feature that touches more than one pipeline layer; changes to store interfaces; adding a new theme.

**Inputs**: User requirement + current `CLAUDE.md` architecture section.

**Outputs**: Updated architecture spec in `CLAUDE.md`, data contracts (TypeScript interfaces), and a decomposition of sub-tasks for Implementation Agents.

**Scope**: Read-only on all files. Writes only to `CLAUDE.md` or creates `agent_docs/` reference files.

**Rules**:

- Never change code directly — only defines contracts and structure
- If a store interface must change, document the migration path before any Implementation Agent begins

---

### Implementation Agent

**Responsibility**: Writes and modifies code within a well-defined, bounded scope.

**Triggers**: A scoped task with clear inputs, outputs, and affected files — typically assigned by the orchestrator after an Architecture Agent has defined the contract.

**Inputs**: Exact file paths to create/modify, TypeScript interface contracts, expected behavior description.

**Outputs**: Working code that passes `bun run check` and `bun run lint`.

**Scope**: One logical slice at a time. Examples of valid scopes:

- `$lib/invoice/builder.ts` — token substitution logic
- `$lib/pdf/generator.ts` — PDF rendering pipeline
- `$lib/stores/session.svelte.ts` — session state shape
- `src/components/ClientCard.svelte` — single UI component

**Rules**:

- Read the file before editing — always
- Run `bun run check` and `bun run lint` before marking task complete
- Validate `.svelte` files with `svelte-autofixer` (svelte MCP) before delivering
- Do not expand scope — if a bug is found in an adjacent file, report it; do not fix it unless explicitly scoped

---

### UI/UX Agent

**Responsibility**: Implements visual changes, layout, design tokens, and animation.

**Triggers**: Any task that modifies `.svelte` files, `src/app.css`, Tailwind classes, or GSAP animation logic.

**Inputs**: Design spec or description, affected component paths, current screenshot (if available).

**Outputs**: Modified `.svelte` or `.css` files, plus Playwright MCP screenshots validating the result.

**Scope**: Visual layer only — components, styles, layout. Never touches `$lib/invoice/`, `$lib/pdf/`, or store logic.

**Rules**:

- **Invoke `frontend-design` skill** at the start of every session, no exceptions
- **Mandatory visual verification** — take at least one Playwright MCP screenshot per change, save to `tmp_screenshots/`, analyze against requirements, iterate until correct
- **Delete `tmp_screenshots/` and `.playwright-mcp/`** after task is complete
- Dark-only design — never introduce light-mode styles
- CSS variables for colors — never hardcode hex/rgb/oklch
- Arrow functions only — no function declarations
- Zero comments in shipped code

---

### Audit Agent

**Responsibility**: Verifies correctness, completeness, and cross-file consistency after Implementation or UI/UX agents complete work.

**Triggers**: After any Implementation Agent marks a task complete; before merging worktrees back to main.

**Inputs**: List of changed files, original requirement, TypeScript contracts.

**Outputs**: Pass/fail verdict with specific issues. If failing, a numbered list of exact problems and where they are.

**Scope**: Read-only. Never modifies code.

**Checklist** (run all before passing):

1. `bun run check` — zero type errors
2. `bun run lint` — zero lint errors
3. Store interfaces match contracts defined by Architecture Agent
4. No relative imports (`../../../`) in any changed file
5. No hardcoded hex/rgb colors in Tailwind classes
6. No `function` declarations (arrow functions only)
7. No comments in shipped code
8. `$lib/components/ui/` files are unmodified (shadcn-svelte auto-generated)
9. `tmp_screenshots/` and `.playwright-mcp/` do not exist in the working tree
10. PDF pipeline integrity: `builder.ts → resolver.ts → generator.ts` chain is unbroken

---

### Refactor Agent

**Responsibility**: Improves code quality, consistency, and maintainability without changing behavior.

**Triggers**: Explicit refactor request; Audit Agent identifies inconsistencies across files; code duplication detected.

**Inputs**: Specific files or patterns to refactor, description of the inconsistency or smell.

**Outputs**: Modified files with identical runtime behavior, passing `bun run check` and `bun run lint`.

**Scope**: One module or pattern at a time. Do not refactor and add features in the same commit.

**Rules**:

- Behavior must be identical before and after — no functional changes
- One commit per logical refactor (e.g., "normalize arrow functions in $lib/invoice/")
- Audit Agent must verify before merge

---

### Theme Agent

**Responsibility**: Creates or modifies invoice themes in the theme system.

**Triggers**: New theme request; existing theme visual update.

**Inputs**: Design spec, color palette, typography choices, payment section copy.

**Outputs**: New theme file in `$lib/themes/`, registered in `registry.ts`, with updated `ThemeId`.

**Scope**: `$lib/themes/` only. Never touches the PDF generation pipeline or stores.

**Rules**:

- Implement the full `Theme` interface: `html`, `css`, `bankPayment`, `wisePayment`
- CSS in the `css` field must be minified (single-line)
- Test by setting `ACTIVE_THEME_ID` to the new theme, generating a sample PDF, and screenshotting the result
- Restore `ACTIVE_THEME_ID` to `"default"` after testing unless the task requires a theme change

---

## Execution Model

### Parallel Execution

Agents can run in parallel when their scopes do not share writable files.

**Safe to parallelize**:

- UI/UX Agent on `src/components/` + Implementation Agent on `$lib/invoice/`
- Theme Agent on `$lib/themes/` + Refactor Agent on `$lib/stores/`
- Multiple Implementation Agents on non-overlapping files

**Must run sequentially**:

- Architecture Agent → Implementation Agents (contracts must be defined first)
- Any agent modifying `$lib/stores/session.svelte.ts` → Audit Agent (store shape affects all consumers)
- Theme Agent → UI/UX Agent (theme must exist before UI references it)
- All agents → Audit Agent (audit always runs last before merge)

### Shared File Handling

If two agents need to modify the same file:

1. Do not run them in parallel
2. First agent completes and commits
3. Second agent reads the updated file before beginning
4. Audit Agent verifies the combined result

### Merge Order

```
Architecture Agent (defines contracts)
    ↓
Implementation Agents (parallel if non-overlapping)
    ↓
UI/UX Agent (depends on store/pipeline contracts)
    ↓
Audit Agent (read-only verification)
    ↓
Merge to main
```

---

## Task Decomposition Rules

### Good Decomposition

Break tasks into atomic units where each unit:

- Has a single clear output (a file, a function, a component)
- Can be verified independently (`bun run check` passes)
- Has no hidden dependencies on other in-flight tasks

**Example — "Add a new invoice theme"**:

```
Task 1 [Theme Agent]:     Create $lib/themes/minimal.ts
Task 2 [Theme Agent]:     Register in registry.ts, update ThemeId
Task 3 [Audit Agent]:     Verify TypeScript types, generate sample PDF
```

**Example — "Add per-client invoice numbering"**:

```
Task 1 [Architecture]:    Define InvoiceEntry shape changes + token spec
Task 2 [Implementation]:  Update $lib/stores/session.svelte.ts
Task 3 [Implementation]:  Update $lib/invoice/builder.ts
Task 4 [UI/UX Agent]:     Update ClientCard.svelte to surface new field
Task 5 [Audit Agent]:     Verify end-to-end: store → builder → PDF
```

### Anti-Patterns to Avoid

- **Mega-tasks**: "Redesign the whole UI" — break into per-component tasks
- **Ambiguous outputs**: "Improve the PDF generation" — specify what improves and how it's measured
- **Cross-cutting changes in one task**: "Refactor stores AND update UI" — these are two tasks

---

## Parity Enforcement Rules

The invoice-generator shares conventions with all other SvelteKit projects in `~/Desktop/projects`. After every agent task:

1. **Svelte 5 runes** — no legacy `export let` or `$:` reactive statements anywhere
2. **Path aliases** — no relative imports from route files (`$lib`, `$src` only)
3. **Arrow functions** — no `function` keyword declarations in `.ts` or `.svelte` files
4. **Zero comments** — no inline, block, or JSDoc comments in shipped code
5. **Tailwind CSS v4** — no `tailwind.config.js`, no hardcoded colors, CSS-first `@theme inline`
6. **shadcn-svelte auto-generated files** — `$lib/components/ui/` is never manually edited

---

## Validation & QA Layer

Every agent output must pass before being accepted:

| Check                  | Command                    | Owner                           |
| ---------------------- | -------------------------- | ------------------------------- |
| Type safety            | `bun run check`            | Implementation, UI/UX, Refactor |
| Lint + format          | `bun run lint`             | All agents                      |
| Visual correctness     | Playwright MCP screenshot  | UI/UX Agent                     |
| Behavioral correctness | Manual PDF generation test | Implementation Agent            |
| Audit pass             | Full checklist             | Audit Agent                     |

**No partial passes.** If `bun run check` fails, the task is not complete. Fix before marking done.

---

## Source of Truth Hierarchy

When an agent needs information or makes a decision, apply this priority:

1. **This codebase** — what the code actually does right now (read the file)
2. **CLAUDE.md** — architectural decisions and patterns for this project
3. **Sibling projects** (`~/Desktop/projects`) — shared patterns, especially `order-processor` and `nordcycle`
4. **Svelte MCP** (`svelte-autofixer`, `get-documentation`) — authoritative Svelte 5 / SvelteKit docs
5. **context7 MCP** — Tailwind CSS v4, shadcn-svelte, fflate, jsPDF, html2canvas
6. **Official documentation** — framework docs, library READMEs
7. **Web search** — last resort only

Never infer behavior from memory or training data when reading the actual file is possible.

---

## Output Standards

Every agent response must be:

- **Structured** — clearly state what was done, what files changed, and what the result is
- **Actionable** — if a problem was found, specify the exact file, line, and fix
- **Deterministic** — same inputs produce the same outputs; no "it depends" without specifying what it depends on
- **Verified** — state explicitly: "`bun run check` passed / failed", "`svelte-autofixer` validated / flagged"
- **Bounded** — report only what was scoped. Don't silently fix unrelated issues

**Final delivery format**:

```
## Changes Made
- [file path]: [what changed and why]

## Verification
- bun run check: PASSED / FAILED (errors listed)
- bun run lint: PASSED / FAILED (errors listed)
- svelte-autofixer: VALIDATED / FLAGGED (issues listed)
- Visual verification: [screenshot path] — [what was checked]

## Blockers / Follow-up
- [anything the next agent or user needs to know]
```

---

## Security & Environment

- **No secrets in code** — this project has no API keys or tokens. If any are added in future, store in `.dev.vars` (gitignored) and access via `event.platform.env`
- **No `.env` or `.dev.vars` committed** — hard requirement
- **No server-side code** — this is a static site. No server actions, no API routes, no Cloudflare Worker logic beyond static asset serving
