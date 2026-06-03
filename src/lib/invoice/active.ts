/**
 * Single source of truth for the "active" filter that gates PDF generation.
 *
 * INVARIANT: an invoice is generatable iff `client.isActive AND entry.isActive`
 * (strict AND gate). Every generation path — GenerationPanel, InvoicePreview,
 * and the session store's derived count — MUST consume these helpers. No caller
 * may iterate raw `client.invoices` for generation; doing so bypasses the gate.
 */
import type { Client, InvoiceEntry } from "$lib/types";

export interface GeneratableInvoice {
	client: Client;
	entry: InvoiceEntry;
}

export const getGeneratableInvoices = (clients: Client[]): GeneratableInvoice[] =>
	clients
		.filter((c) => c.isActive)
		.flatMap((c) => c.invoices.filter((e) => e.isActive).map((entry) => ({ client: c, entry })));

export const countGeneratableInvoices = (clients: Client[]): number =>
	getGeneratableInvoices(clients).length;

export const firstGeneratableInvoice = (client: Client): InvoiceEntry | null => {
	if (!client.isActive) return null;
	return client.invoices.find((e) => e.isActive) ?? null;
};
