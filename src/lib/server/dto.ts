import type {
	Client,
	Fixed,
	InvoiceEntry,
	MonthName,
	PaymentMethodKind,
	SavedPaymentMethod
} from "$lib/types";
import type { schema } from "./db";
import type { InferSelectModel } from "drizzle-orm";

type ClientRow = InferSelectModel<typeof schema.clients>;
type EntryRow = InferSelectModel<typeof schema.invoiceEntries>;
type MethodRow = InferSelectModel<typeof schema.paymentMethods>;
type FixedRow = InferSelectModel<typeof schema.fixedSettings>;

export interface AppState {
	fixed: Fixed;
	clients: Client[];
	selectedClientId: string | null;
	expandedClients: Record<string, boolean>;
}

export const toSavedPaymentMethod = (row: MethodRow): SavedPaymentMethod => ({
	id: row.id,
	kind: row.kind as PaymentMethodKind,
	label: row.label,
	values: row.values ?? {}
});

export const toInvoiceEntry = (row: EntryRow): InvoiceEntry => ({
	id: row.id,
	month: row.month as MonthName,
	issueDay: row.issueDay,
	dueDay: row.dueDay
});

export const toClient = (row: ClientRow, entries: EntryRow[], methodIds: string[]): Client => ({
	id: row.id,
	name: row.name,
	invoicePrefix: row.invoicePrefix,
	phone: row.phone,
	email: row.email,
	address: row.address ?? [""],
	service: {
		description: row.serviceDescription,
		amount: row.serviceAmount,
		currency: row.serviceCurrency
	},
	payment: { methodIds },
	year: row.year,
	invoices: entries.map(toInvoiceEntry)
});

export const toFixed = (row: FixedRow | undefined, methods: SavedPaymentMethod[]): Fixed => ({
	from: {
		name: row?.fromName ?? "",
		phone: row?.fromPhone ?? "",
		email: row?.fromEmail ?? "",
		address: row?.fromAddress ?? ""
	},
	paymentMethods: methods
});
