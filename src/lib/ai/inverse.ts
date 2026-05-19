import type { Client, InvoiceEntry, SavedPaymentMethod } from "$lib/types";
import type { InverseRecord } from "./types";

export type { InverseRecord } from "./types";

export interface ClientSnapshot {
	name: string;
	invoicePrefix: string;
	phone: string;
	email: string;
	address: string[];
	serviceDescription: string;
	serviceAmount: number;
	serviceCurrency: string;
	year: number;
	isActive: boolean;
	paymentMethodIds: string[];
	invoices: InvoiceEntry[];
}

export interface PaymentMethodSnapshot {
	id: string;
	kind: string;
	label: string;
	values: Record<string, string>;
}

export const snapshotClient = (client: Client): ClientSnapshot => ({
	name: client.name,
	invoicePrefix: client.invoicePrefix,
	phone: client.phone,
	email: client.email,
	address: [...client.address],
	serviceDescription: client.service.description,
	serviceAmount: client.service.amount,
	serviceCurrency: client.service.currency,
	year: client.year,
	isActive: client.isActive,
	paymentMethodIds: [...client.payment.methodIds],
	invoices: client.invoices.map((e) => ({ ...e }))
});

export const snapshotPaymentMethod = (method: SavedPaymentMethod): PaymentMethodSnapshot => ({
	id: method.id,
	kind: method.kind,
	label: method.label,
	values: { ...method.values }
});

export const inverseForCreateClient = (newId: string): InverseRecord => ({
	tool: "deleteClient",
	args: { clientId: newId }
});

export const inverseForUpdateClient = (
	clientId: string,
	snapshot: ClientSnapshot
): InverseRecord => ({
	tool: "updateClient",
	args: {
		clientId,
		patch: {
			name: snapshot.name,
			invoicePrefix: snapshot.invoicePrefix,
			phone: snapshot.phone,
			email: snapshot.email,
			address: snapshot.address,
			serviceDescription: snapshot.serviceDescription,
			serviceAmount: snapshot.serviceAmount,
			serviceCurrency: snapshot.serviceCurrency,
			year: snapshot.year,
			isActive: snapshot.isActive
		}
	},
	snapshot
});

export const inverseForDeleteClient = (snapshot: ClientSnapshot): InverseRecord => ({
	tool: "restoreClient",
	args: {},
	snapshot
});

export const inverseForAddInvoiceEntries = (
	clientId: string,
	newEntryIds: string[]
): InverseRecord => ({
	tool: "deleteInvoiceEntries",
	args: { clientId, entryIds: newEntryIds }
});

export const inverseForUpdateInvoiceEntry = (
	clientId: string,
	entryId: string,
	snapshot: InvoiceEntry
): InverseRecord => ({
	tool: "updateInvoiceEntry",
	args: {
		clientId,
		entryId,
		patch: {
			month: snapshot.month,
			issueDay: snapshot.issueDay,
			dueDay: snapshot.dueDay,
			isActive: snapshot.isActive
		}
	},
	snapshot
});

export const inverseForRemoveInvoiceEntry = (
	clientId: string,
	snapshot: InvoiceEntry
): InverseRecord => ({
	tool: "restoreInvoiceEntry",
	args: { clientId },
	snapshot
});

export const inverseForSetActive = (
	tool: "setClientActive" | "setInvoiceActive",
	args: Record<string, unknown>,
	previous: boolean
): InverseRecord => ({
	tool,
	args: { ...args, isActive: previous }
});

export const inverseForTogglePaymentMethod = (
	clientId: string,
	paymentMethodId: string
): InverseRecord => ({
	tool: "togglePaymentMethod",
	args: { clientId, paymentMethodId }
});

export const inverseForReorderClientPaymentMethods = (
	clientId: string,
	previousOrder: string[]
): InverseRecord => ({
	tool: "reorderClientPaymentMethods",
	args: { clientId, orderedIds: previousOrder }
});

export const inverseForUpdateFixedField = (
	field: string,
	previousValue: string
): InverseRecord => ({
	tool: "updateFixedField",
	args: { field, value: previousValue }
});

export const inverseForAddPaymentMethod = (newId: string): InverseRecord => ({
	tool: "removePaymentMethod",
	args: { paymentMethodId: newId }
});

export const inverseForUpdatePaymentMethodValue = (
	paymentMethodId: string,
	field: string,
	previousValue: string
): InverseRecord => ({
	tool: "updatePaymentMethodValue",
	args: { paymentMethodId, field, value: previousValue }
});

export const inverseForUpdatePaymentMethodLabel = (
	paymentMethodId: string,
	previousLabel: string
): InverseRecord => ({
	tool: "updatePaymentMethodLabel",
	args: { paymentMethodId, label: previousLabel }
});

export const inverseForRemovePaymentMethod = (
	snapshot: PaymentMethodSnapshot,
	usedByClientIds: string[]
): InverseRecord => ({
	tool: "restorePaymentMethod",
	args: { usedByClientIds },
	snapshot
});

export const inverseForMovePaymentMethod = (
	paymentMethodId: string,
	direction: -1 | 1
): InverseRecord => ({
	tool: "movePaymentMethod",
	args: { paymentMethodId, direction: (direction === 1 ? -1 : 1) as -1 | 1 }
});

export const inverseForSetSelectedClientId = (previousId: string | null): InverseRecord => ({
	tool: "setSelectedClientId",
	args: { clientId: previousId }
});

export const inverseForPolishText = (
	target: string,
	clientId: string | undefined,
	paymentMethodId: string | undefined,
	previousText: string
): InverseRecord => ({
	tool: "polishText",
	args: { target, clientId, paymentMethodId, proposedText: previousText }
});
