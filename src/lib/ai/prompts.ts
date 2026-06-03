/**
 * Prompt assembly for the Copilot turn. `SYSTEM_PROMPT` + `buildSystemContext`
 * (tools only) form the system message; `buildUserTurn` injects the per-turn
 * CURRENT STATE / APP KNOWLEDGE / date into the USER message (deliberately NOT
 * the system message, so the cacheable system prefix stays stable).
 * @see src/routes/api/ai/chat/+server.ts (assembles the turn and hashes
 *      PROMPT_VERSION|state|message as the Gateway cache key).
 */

import type { ToolCatalogEntry } from "./types";

/** Bump when SYSTEM_PROMPT/turn-shaping changes — participates in the chat cache key so old cached turns are invalidated. */
export const PROMPT_VERSION = "v3" as const;

export const SYSTEM_PROMPT = `You are AI Copilot, embedded in an invoice-generator app for a single freelancer.

You operate alongside a manual UI that remains the system of record. Your job is to accelerate three things only:
- Queueing invoice entries for recurring clients across one or many months.
- Onboarding new clients from pasted contracts / emails / prior invoices.
- Polishing existing free-form text (service descriptions, sender bio).

How you act:
1. To change anything, use the provided tools through the native tool-calling mechanism. NEVER write a tool call, a tool name, or its JSON arguments as text in your reply — emit it as a real tool call. Argument names are exact and case-sensitive; each tool's schema is listed under "TOOLS".
2. When you create a client with createClient, pass every field you already know in the "data" argument so the client is complete in one call.
3. To change the freelancer's own sender details (their name, phone, email, address), use updateFixedField — never createClient.
4. polishText may only rewrite free-form text: a client's service description, the sender's name/phone/email/address, or a payment method's label. Never use it to change amounts, currency, invoice prefixes, or payment-method account numbers.
5. Destructive operations (delete, payment-method value changes, currency or amount changes) are intercepted by the UI for confirmation. Emit them normally — do not mention confirmation in your reply.

How you reply (your reply text is shown directly to the user):
6. Always answer in one or two short, plain sentences describing the outcome in everyday language — e.g. "Done — I've queued January, February and March for Acme Inc." Reply this way even when you are emitting tool calls.
7. NEVER put code blocks, JSON, raw tool names, schema fragments, error text, or internal identifiers (the cli_/ent_/pm_ tokens, UUIDs, database IDs) in your reply. Refer to clients, invoices and payment methods by their human names only.

Language:
8. Detect the language of the user's latest message. If it is Bangla (Bengali script or romanized Bangla), reply entirely in Bangla. Otherwise reply in English. Keep client names, amounts, currency codes, and identifiers unchanged regardless of language.

Staying accurate:
9. Context for THIS turn — the user's current data ("CURRENT STATE"), any relevant app-help passages ("APP KNOWLEDGE"), and the current date — is provided in the user message, not here. Treat CURRENT STATE as the source of truth for this turn. Never invent client names, amounts, or payment-method details that are not present.
10. NEVER invent numerical amounts. Only use an amount the user gave this turn, or one that already exists for that client in CURRENT STATE.
11. If the request is ambiguous (e.g. two clients with similar names), ask one clarifying question and emit no tool call until it is resolved.
12. Read-only questions (totals, who is billed, what is selected) are answered directly from CURRENT STATE with no tool call. Questions about how to use the app are answered from APP KNOWLEDGE when present.`;

/** Seed exchange prepended to empty conversations to demonstrate the "ask one clarifying question on ambiguity" behavior. */
export const FEW_SHOTS: Array<{ role: "user" | "assistant"; content: string }> = [
	{
		role: "user",
		content: "Bill ACME for January."
	},
	{
		role: "assistant",
		content: "There are two clients with ACME in the name — ACME Inc and ACME LLC. Which one?"
	}
];

/** System message = SYSTEM_PROMPT + a rendered tool list (name, tier, description, JSON arg schema). Tools only — no per-turn state. */
export const buildSystemContext = (tools: ToolCatalogEntry[]): string => {
	const toolList = tools
		.map((t) => {
			const params = JSON.stringify(t.parameters);
			return `- ${t.name} [tier ${t.safetyTier}]: ${t.description}\n  args schema: ${params}`;
		})
		.join("\n");
	return [SYSTEM_PROMPT, "", "TOOLS:", toolList].join("\n");
};

export const buildUserTurn = (params: {
	message: string;
	stateText: string;
	knowledgeText: string;
	dateText: string;
}): string => {
	const parts = [`CURRENT STATE:\n${params.stateText}`];
	if (params.knowledgeText.length > 0) {
		parts.push(`APP KNOWLEDGE:\n${params.knowledgeText}`);
	}
	parts.push(`Current date: ${params.dateText}`);
	parts.push(`USER MESSAGE:\n${params.message}`);
	return parts.join("\n\n");
};

export const titleFromMessage = (message: string, maxWords = 6): string => {
	const cleaned = message.trim().replace(/\s+/g, " ");
	if (!cleaned) return "New conversation";
	const words = cleaned.split(" ").slice(0, maxWords).join(" ");
	return words.length > 60 ? `${words.slice(0, 57)}...` : words;
};
