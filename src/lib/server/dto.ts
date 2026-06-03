/**
 * Pure row → domain mappers (no I/O). Translate Drizzle row shapes into the client-facing
 * domain types in $lib/types, reshaping flat columns into nested objects (e.g. service.*,
 * payment.methodIds) and defaulting nullable columns. Used by repositories and loadAppState.
 */
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
	dueDay: row.dueDay,
	isActive: row.isActive
});

/** entries and methodIds must be pre-fetched and pre-ordered by the caller; this mapper does
 * no DB access and preserves the given order. createdAt is serialized to an ISO string. */
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
	isActive: row.isActive,
	invoices: entries.map(toInvoiceEntry),
	createdAt: row.createdAt.toISOString()
});

/** Tolerates a missing fixed_settings row (new users have none) by defaulting all sender
 * fields to empty strings. selectedClientId is NOT part of Fixed — read it from the row separately. */
export const toFixed = (row: FixedRow | undefined, methods: SavedPaymentMethod[]): Fixed => ({
	from: {
		name: row?.fromName ?? "",
		phone: row?.fromPhone ?? "",
		email: row?.fromEmail ?? "",
		address: row?.fromAddress ?? ""
	},
	paymentMethods: methods
});
