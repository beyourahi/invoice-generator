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
