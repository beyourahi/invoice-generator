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

const projectInvoice = (entry: InvoiceEntry, index: number): ContextInvoice => ({
	token: `ent_${index + 1}`,
	id: entry.id,
	month: entry.month,
	issueDay: entry.issueDay,
	dueDay: entry.dueDay,
	isActive: entry.isActive
});

const projectClient = (
	client: Client,
	clientIndex: number,
	tokenMap: Record<string, string>
): ContextClient => {
	const invoices = client.invoices.map((entry, idx) => {
		const projected = projectInvoice(entry, idx);
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
			const monthList = c.invoices.map((i) => `${i.month}${i.isActive ? "" : "·off"}`).join(", ");
			const amountLabel = formatAmount(c.amount, c.currency as Currency);
			lines.push(
				`  ${c.token} "${c.name || "(unnamed)"}" prefix=${c.invoicePrefix || "(none)"} year=${c.year} active=${c.isActive} amount=${amountLabel}/mo entries=${active}/${total}${total > 0 ? ` [${monthList}]` : ""}`
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

export const projectAppState = (appState: AppState): ContextPayload => {
	const tokenMap: Record<string, string> = {};

	const paymentMethods = appState.fixed.paymentMethods.map((m, i) => {
		const projected = projectPaymentMethod(m, i);
		tokenMap[projected.token] = m.id;
		return projected;
	});

	const clients = appState.clients.map((c, i) => {
		const projected = projectClient(c, i, tokenMap);
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
