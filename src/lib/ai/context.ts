/**
 * Bidirectional state-tokenization for the prompt context.
 * `projectAppState` serializes the user's data into a compact human-readable
 * summary using short opaque tokens (cli_N, ent_N, pm_N) in place of real
 * UUIDs — this keeps prompt tokens cheap and stops the model leaking raw IDs.
 * `decodeTokens` reverses the mapping on tool-call args the model returns.
 * INVARIANT: tool execution must run decoded args (real IDs); the tokenMap from
 * projectAppState is the only valid decode source for the same turn.
 * @see ./prompts.ts buildUserTurn (embeds summaryText), src/routes/api/ai/chat/+server.ts.
 */

import type { AppState } from "$lib/server/dto";
import type { Client, InvoiceEntry, SavedPaymentMethod } from "$lib/types";
import { formatAmount } from "$lib/format/currency";
import type { Currency } from "$lib/types";

export interface ContextClient {
	token: string;
	id: string;
	name: string;
	invoicePrefix: string;
	year: number;
	isActive: boolean;
	currency: string;
	amount: number;
	serviceDescription: string;
	createdAt: string;
	paymentMethods: string[];
	invoices: ContextInvoice[];
}

export interface ContextInvoice {
	token: string;
	id: string;
	month: string;
	issueDay: string;
	dueDay: string;
	isActive: boolean;
}

export interface ContextPaymentMethod {
	token: string;
	id: string;
	kind: string;
	label: string;
	last4: string;
}

export interface ContextPayload {
	from: {
		name: string;
		email: string;
		phone: string;
		address: string;
	};
	selectedClientId: string | null;
	paymentMethods: ContextPaymentMethod[];
	clients: ContextClient[];
	summaryText: string;
	tokenMap: Record<string, string>;
}

/** Last 4 chars of a whitespace-stripped value; used to hint payment methods without exposing full account numbers. */
const last4 = (raw: string | undefined): string => {
	if (!raw) return "";
	const stripped = raw.replace(/\s+/g, "");
	if (stripped.length <= 4) return stripped;
	return stripped.slice(-4);
};

const projectPaymentMethod = (method: SavedPaymentMethod, index: number): ContextPaymentMethod => {
	const flat = Object.values(method.values ?? {}).find((v) => v && v.trim().length > 0);
	return {
		token: `pm_${index + 1}`,
		id: method.id,
		kind: method.kind,
		label: method.label,
		last4: last4(flat)
	};
};

const projectInvoice = (entry: InvoiceEntry, token: string): ContextInvoice => ({
	token,
	id: entry.id,
	month: entry.month,
	issueDay: entry.issueDay,
	dueDay: entry.dueDay,
	isActive: entry.isActive
});

const projectClient = (
	client: Client,
	clientIndex: number,
	tokenMap: Record<string, string>,
	nextEntryToken: () => string
): ContextClient => {
	const invoices = client.invoices.map((entry) => {
		// Entry tokens come from a single global counter (not a per-client index)
		// so ent_N never collides across clients in the shared tokenMap.
		const projected = projectInvoice(entry, nextEntryToken());
		tokenMap[projected.token] = entry.id;
		return projected;
	});
	return {
		token: `cli_${clientIndex + 1}`,
		id: client.id,
		name: client.name,
		invoicePrefix: client.invoicePrefix,
		year: client.year,
		isActive: client.isActive,
		currency: client.service.currency,
		amount: client.service.amount,
		serviceDescription: client.service.description,
		createdAt: client.createdAt ? new Date(client.createdAt).toISOString().slice(0, 10) : "",
		paymentMethods: client.payment.methodIds,
		invoices
	};
};

const renderSummary = (payload: Omit<ContextPayload, "summaryText" | "tokenMap">): string => {
	const lines: string[] = [];
	const fromBits = [payload.from.name, payload.from.email].filter(Boolean).join(" · ");
	lines.push(`Sender: ${fromBits || "(unset)"}`);
	lines.push(
		`Payment methods: ${
			payload.paymentMethods.length === 0
				? "none"
				: payload.paymentMethods
						.map((m) => `${m.token}=${m.label}${m.last4 ? ` (…${m.last4})` : ""}`)
						.join(", ")
		}`
	);
	if (payload.clients.length === 0) {
		lines.push("Clients: none");
	} else {
		lines.push(`Clients (${payload.clients.length}):`);
		for (const c of payload.clients) {
			const total = c.invoices.length;
			const active = c.invoices.filter((i) => i.isActive).length;
			const monthList = c.invoices
				.map((i) => `${i.token}=${i.month}${i.isActive ? "" : "·off"}`)
				.join(", ");
			const amountLabel = formatAmount(c.amount, c.currency as Currency);
			lines.push(
				`  ${c.token} "${c.name || "(unnamed)"}" prefix=${c.invoicePrefix || "(none)"} year=${c.year} active=${c.isActive} amount=${amountLabel}/mo entries=${active}/${total}${c.createdAt ? ` created=${c.createdAt}` : ""}${total > 0 ? ` [${monthList}]` : ""}`
			);
			if (c.serviceDescription) {
				const trimmed =
					c.serviceDescription.length > 80
						? `${c.serviceDescription.slice(0, 77)}...`
						: c.serviceDescription;
				lines.push(`    description: ${trimmed}`);
			}
			if (c.paymentMethods.length > 0) {
				lines.push(`    payment methods: ${c.paymentMethods.join(", ")}`);
			}
		}
	}
	if (payload.selectedClientId) {
		lines.push(`Selected client: ${payload.selectedClientId}`);
	}
	return lines.join("\n");
};

const STATE_TOKEN_RE = /^(?:cli|ent|pm)_\d+$/;

/**
 * Recursively walks arbitrary tool-call args, replacing any string that is
 * exactly a state token with its real ID from `tokenMap`. Non-token strings,
 * numbers, and unmapped tokens pass through unchanged.
 */
export const decodeTokens = <T>(value: T, tokenMap: Record<string, string>): T => {
	if (typeof value === "string") {
		return (STATE_TOKEN_RE.test(value) && tokenMap[value] ? tokenMap[value] : value) as T;
	}
	if (Array.isArray(value)) {
		return value.map((item) => decodeTokens(item, tokenMap)) as T;
	}
	if (value && typeof value === "object") {
		const decoded: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(value)) {
			decoded[key] = decodeTokens(item, tokenMap);
		}
		return decoded as T;
	}
	return value;
};

/**
 * Builds the per-turn context payload. Assigns tokens in iteration order
 * (payment methods first, then clients/invoices) and returns the `tokenMap`
 * needed to decode the model's reply via decodeTokens. `summaryText` is the
 * human-readable block injected as CURRENT STATE.
 */
export const projectAppState = (appState: AppState): ContextPayload => {
	const tokenMap: Record<string, string> = {};

	const paymentMethods = appState.fixed.paymentMethods.map((m, i) => {
		const projected = projectPaymentMethod(m, i);
		tokenMap[projected.token] = m.id;
		return projected;
	});

	let entryCounter = 0;
	const nextEntryToken = (): string => `ent_${++entryCounter}`;
	const clients = appState.clients.map((c, i) => {
		const projected = projectClient(c, i, tokenMap, nextEntryToken);
		tokenMap[projected.token] = c.id;
		return projected;
	});

	const base: Omit<ContextPayload, "summaryText" | "tokenMap"> = {
		from: {
			name: appState.fixed.from.name,
			email: appState.fixed.from.email,
			phone: appState.fixed.from.phone,
			address: appState.fixed.from.address
		},
		selectedClientId: appState.selectedClientId,
		paymentMethods,
		clients
	};

	return {
		...base,
		summaryText: renderSummary(base),
		tokenMap
	};
};
