# AI Copilot — Regression Prompt Set

Fixed regression set for the AI Copilot, fulfilling PRD **Area J**. Every prompt
below has a deterministic expected behaviour. Run the set after any change to
`prompts.ts`, `tools-catalog.ts`, `tools.ts`, `executor.ts`, `safety.ts`, or the
model id, and record the resulting `tool_call_success_rate`.

- **Prompt bundle version:** `v1` (`PROMPT_VERSION` in `src/lib/ai/prompts.ts`)
- **Model:** `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, temperature `0.2`
- **`tool_call_success_rate`** = (tool calls that pass Zod validation after the
  single corrective retry) / (total tool calls emitted). Target ≥ 92% (NFR-6
  ceiling: ≤ 8% Zod-validation failures).
- **Anomaly false-positive rate** target ≤ 5%.

Baseline measurement requires the deployed Worker with the `AI` binding and AI
Gateway reachable — it cannot be produced from `bun run dev` (no AI binding) and
is recorded in deployment notes, not in this file.

Each row lists the seed state assumed before the prompt. "Clients" refers to a
populated `AppState`; "ACME" etc. are example client names.

## 1. Queue-cycle

| #   | Prompt                                                   | Expected behaviour                                                                 |
| --- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Q1  | "Add this month's invoice for ACME."                     | One `addInvoiceEntries` call, one month, Tier A auto-apply.                        |
| Q2  | "Queue January, February and March for ACME."            | One `addInvoiceEntries` call with `months: [January, February, March]`.            |
| Q3  | "Add the next quarter for Globex."                       | One `addInvoiceEntries` call with three consecutive months from the current month. |
| Q4  | "Bill all active clients for April."                     | One `addInvoiceEntries` call per active client; all Tier A.                        |
| Q5  | "Set up the usual monthly invoices for ACME and Globex." | Two `addInvoiceEntries` calls, one per client.                                     |

## 2. Polish

| #   | Prompt                                                       | Expected behaviour                                                                         |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| P1  | "Rewrite ACME's service description in past tense."          | One `polishText` call, `target: clientServiceDescription`; inline diff with Apply/Reject.  |
| P2  | "Make my sender bio more concise."                           | One `polishText` call targeting a `from*` field; inline diff.                              |
| P3  | "Expand the description for Globex and make it more formal." | One `polishText` call, `target: clientServiceDescription`.                                 |
| P4  | "Change ACME's amount wording to sound friendlier."          | Model refuses or asks — `polishText` must not touch `amount`; no numeric mutation (FR-30). |

## 3. Delete-with-confirm

| #   | Prompt                                  | Expected behaviour                                                                        |
| --- | --------------------------------------- | ----------------------------------------------------------------------------------------- |
| D1  | "Delete the January invoice for ACME."  | One `removeInvoiceEntry` call; Tier B confirmation dialog with inverse summary.           |
| D2  | "Remove ACME entirely."                 | One `deleteClient` call; Tier B confirmation dialog.                                      |
| D3  | "Delete the Wise payment method."       | One `removePaymentMethod` call; Tier B confirmation dialog.                               |
| D4  | "Change ACME's monthly amount to 2500." | `updateClient` with `serviceAmount`; demoted to Tier B (money field) with old → new diff. |

## 4. Ambiguous-name disambiguation

| #   | Prompt                                                          | Expected behaviour                         |
| --- | --------------------------------------------------------------- | ------------------------------------------ |
| A1  | "Bill ACME for January." (both "ACME Inc" and "ACME LLC" exist) | No tool call; assistant asks which ACME.   |
| A2  | "Delete the client." (more than one client exists)              | No tool call; assistant asks which client. |
| A3  | "Polish the description." (more than one client exists)         | No tool call; assistant asks which client. |

## 5. Anomaly triggers

| #   | Prompt                                                        | Expected behaviour                                                         |
| --- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| N1  | "Set ACME's amount to 50." (ACME usually 2000, ≥3 invoices)   | `updateClient` demoted to Tier B; `AmountOutlier` anomaly badge in dialog. |
| N2  | "Add Jan through Dec plus next Jan-Mar for ACME." (15 months) | `addInvoiceEntries` demoted to Tier B; `VolumeSurge` anomaly (> 12).       |
| N3  | "Create a new client called Initech." (no payment methods)    | `createClient` demoted to Tier B; `MissingPaymentMethods` anomaly.         |
| N4  | "Add an invoice for ACME for a month eight months ago."       | `addInvoiceEntries` demoted to Tier B; `StalePeriod` anomaly.              |
| N5  | "Switch ACME to USD." (existing entries, currency was BDT)    | `updateClient` demoted to Tier B; `CurrencyMismatch` anomaly.              |

## 6. Undo

| #   | Prompt / action                                         | Expected behaviour                                                             |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| U1  | After Q1 applies, click Undo on the tool badge.         | `POST /api/ai/undo/[id]` runs the inverse; entry removed; row marked `undone`. |
| U2  | After Q1 applies, click Undo in the toast (within 10s). | Same inverse executes; identical resulting state.                              |
| U3  | After Q1 applies, click Undo in the AI History panel.   | Same inverse executes; identical resulting state.                              |

## 7. Undo-invalidation

| #   | Prompt / action                                                   | Expected behaviour                                                                   |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| V1  | Q2 adds 3 entries; manually delete one; then Undo Q2's action.    | `UndoInvalidatedError`; explanatory error toast; `undo_failed` row; no partial undo. |
| V2  | D2 deletes ACME; recreate a client manually; Undo is still valid. | Undo recreates ACME from the snapshot independently of the manual client.            |

## 8. Quota exhaust

| #   | Prompt / action                                   | Expected behaviour                                                              |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| QX1 | Submit the 201st chat turn within one UTC day.    | `429 quota_exceeded`; chat message states the reset time; manual UI unaffected. |
| QX2 | Exceed the monthly spend cap, then submit a turn. | `429 spend_cap_reached`; chat message states the cap; manual UI unaffected.     |

## 9. Parse-failure / corrective retry

| #   | Prompt / induced fault                                           | Expected behaviour                                                                          |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| R1  | Model emits `addInvoiceEntries({ months: "January" })` (string). | Server validation fails; one corrective retry with a structured error; corrected call runs. |
| R2  | Model emits `updateClient` with an empty `patch`.                | Validation fails ("Empty patch"); one corrective retry.                                     |
| R3  | Model emits malformed JSON tool arguments.                       | Validation fails; one corrective retry; second failure surfaces a `failed` badge.           |

## 10. Unknown-tool

| #   | Prompt / induced fault                                         | Expected behaviour                                                                  |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| T1  | Model emits a call to `sendInvoiceEmail` (not in the catalog). | Server validation flags unknown tool; one corrective retry with the valid catalog.  |
| T2  | Model emits `listClients` (not in the catalog).                | Unknown-tool path; corrective retry; if unresolved, a `failed` badge, no execution. |

## 11. Multi-tool batching

| #   | Prompt                                                  | Expected behaviour                                                                      |
| --- | ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| M1  | "Delete the January and February invoices for ACME."    | Two `removeInvoiceEntry` calls; one batch confirmation dialog with per-item reject.     |
| M2  | "Add March for ACME and delete ACME's January invoice." | One Tier A `addInvoiceEntries` auto-applies; one Tier B `removeInvoiceEntry` confirmed. |
| M3  | "Mark ACME inactive and queue April for Globex."        | One `setClientActive` (Tier A) and one `addInvoiceEntries` (Tier A); both auto-apply.   |

## 12. Read-only queries

| #   | Prompt                                                | Expected behaviour                                                                        |
| --- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| RO1 | "What's my total invoiced amount for active clients?" | Textual answer from injected context; no tool call; no `ai_actions` row.                  |
| RO2 | "Which clients haven't been billed for February?"     | Textual answer from injected context; no tool call.                                       |
| RO3 | "Give me a summary of everything."                    | Either a textual answer or one `getAppStateSummary` call; no `ai_actions` row either way. |
