import { z } from "zod";
import { api } from "$lib/api/client";
import { session } from "$lib/stores/session.svelte";
import { fixed } from "$lib/stores/fixed.svelte";
import { MONTHS } from "$lib/invoice/months";
import type {
	Client,
	Currency,
	InvoiceEntry,
	MonthName,
	PaymentMethodKind,
	SavedPaymentMethod
} from "$lib/types";
import {
	inverseForAddInvoiceEntries,
	inverseForAddPaymentMethod,
	inverseForCreateClient,
	inverseForDeleteClient,
	inverseForMovePaymentMethod,
	inverseForPolishText,
	inverseForRemoveInvoiceEntry,
	inverseForRemovePaymentMethod,
	inverseForReorderClientPaymentMethods,
	inverseForSetActive,
	inverseForSetSelectedClientId,
	inverseForTogglePaymentMethod,
	inverseForUpdateClient,
	inverseForUpdateFixedField,
	inverseForUpdateInvoiceEntry,
	inverseForUpdatePaymentMethodLabel,
	inverseForUpdatePaymentMethodValue,
	snapshotClient,
	snapshotPaymentMethod
} from "./inverse";
import type { InverseRecord } from "./types";

export interface ToolExecutionResult {
	inverse: InverseRecord;
	summary: string;
}

const PAYMENT_KINDS = [
	"bank",
	"bkash",
	"nagad",
	"rocket",
	"wise",
	"payoneer",
	"paypal",
	"custom"
] as const;
const CURRENCIES = ["BDT", "USD"] as const;
const MONTH_VALUES = MONTHS as readonly MonthName[];

const findClient = (id: string): Client | undefined => session.clients.find((c) => c.id === id);
const findEntry = (clientId: string, entryId: string): InvoiceEntry | undefined =>
	findClient(clientId)?.invoices.find((e) => e.id === entryId);
const findMethod = (id: string): SavedPaymentMethod | undefined =>
	fixed.value.paymentMethods.find((m) => m.id === id);

const ensureClient = (id: string): Client => {
	const c = findClient(id);
	if (!c) throw new Error(`Client ${id} not found in current state.`);
	return c;
};
const ensureEntry = (clientId: string, entryId: string): InvoiceEntry => {
	const e = findEntry(clientId, entryId);
	if (!e) throw new Error(`Entry ${entryId} not found on client ${clientId}.`);
	return e;
};
const ensureMethod = (id: string): SavedPaymentMethod => {
	const m = findMethod(id);
	if (!m) throw new Error(`Payment method ${id} not found.`);
	return m;
};

const POLISH_TARGETS = [
	"clientServiceDescription",
	"fromName",
	"fromPhone",
	"fromEmail",
	"fromAddress",
	"paymentMethodLabel"
] as const;

const monthEnum = z.enum(MONTH_VALUES as unknown as [MonthName, ...MonthName[]]);

export const argSchemas = {
	createClient: z
		.object({
			templateId: z.string().nullable().optional()
		})
		.default({}),
	updateClient: z.object({
		clientId: z.string().min(1),
		patch: z
			.object({
				name: z.string().max(200).optional(),
				invoicePrefix: z.string().max(40).optional(),
				phone: z.string().max(60).optional(),
				email: z.string().max(200).optional(),
				address: z.array(z.string().max(2000)).max(8).optional(),
				serviceDescription: z.string().max(2000).optional(),
				serviceAmount: z.number().min(0).max(1_000_000_000).optional(),
				serviceCurrency: z.enum(CURRENCIES).optional(),
				year: z.number().int().min(2000).max(2099).optional(),
				isActive: z.boolean().optional()
			})
			.refine((v) => Object.keys(v).length > 0, { message: "Empty patch" })
	}),
	deleteClient: z.object({ clientId: z.string().min(1) }),
	addInvoiceEntries: z.object({
		clientId: z.string().min(1),
		months: z.array(monthEnum).min(1).max(24)
	}),
	updateInvoiceEntry: z.object({
		clientId: z.string().min(1),
		entryId: z.string().min(1),
		patch: z
			.object({
				month: monthEnum.optional(),
				issueDay: z
					.string()
					.regex(/^\d{0,2}$/)
					.optional(),
				dueDay: z
					.string()
					.regex(/^\d{0,2}$/)
					.optional(),
				isActive: z.boolean().optional()
			})
			.refine((v) => Object.keys(v).length > 0, { message: "Empty patch" })
	}),
	removeInvoiceEntry: z.object({
		clientId: z.string().min(1),
		entryId: z.string().min(1)
	}),
	setClientActive: z.object({ clientId: z.string().min(1), isActive: z.boolean() }),
	setInvoiceActive: z.object({
		clientId: z.string().min(1),
		entryId: z.string().min(1),
		isActive: z.boolean()
	}),
	togglePaymentMethod: z.object({
		clientId: z.string().min(1),
		paymentMethodId: z.string().min(1)
	}),
	reorderClientPaymentMethods: z.object({
		clientId: z.string().min(1),
		orderedIds: z.array(z.string()).max(32)
	}),
	updateFixedField: z.object({
		field: z.enum(["name", "phone", "email", "address"]),
		value: z.string().max(2000)
	}),
	addPaymentMethod: z.object({
		kind: z.enum(PAYMENT_KINDS satisfies readonly PaymentMethodKind[])
	}),
	updatePaymentMethodValue: z.object({
		paymentMethodId: z.string().min(1),
		field: z.string().min(1).max(120),
		value: z.string().max(2000)
	}),
	updatePaymentMethodLabel: z.object({
		paymentMethodId: z.string().min(1),
		label: z.string().min(1).max(120)
	}),
	removePaymentMethod: z.object({ paymentMethodId: z.string().min(1) }),
	movePaymentMethod: z.object({
		paymentMethodId: z.string().min(1),
		direction: z.union([z.literal(-1), z.literal(1)])
	}),
	polishText: z.object({
		target: z.enum(POLISH_TARGETS),
		clientId: z.string().optional(),
		paymentMethodId: z.string().optional(),
		proposedText: z.string().min(1).max(4000)
	}),
	setSelectedClientId: z.object({ clientId: z.string().nullable() })
} as const;

export type ArgsOf<K extends keyof typeof argSchemas> = z.infer<(typeof argSchemas)[K]>;

const fillRemainingFields = async (clientId: string, patch: Record<string, unknown>) => {
	if (Object.keys(patch).length === 0) return;
	const target = ensureClient(clientId);
	const next: Record<string, unknown> = { ...patch };
	delete next.isActive;
	if (Object.keys(next).length === 0) return;
	const mapped: Parameters<typeof session.updateClient>[1] = {};
	if (typeof next.name === "string") mapped.name = next.name;
	if (typeof next.invoicePrefix === "string") mapped.invoicePrefix = next.invoicePrefix;
	if (typeof next.phone === "string") mapped.phone = next.phone;
	if (typeof next.email === "string") mapped.email = next.email;
	if (Array.isArray(next.address)) mapped.address = next.address as string[];
	if (typeof next.serviceDescription === "string")
		mapped.serviceDescription = next.serviceDescription;
	if (typeof next.serviceAmount === "number") mapped.serviceAmount = next.serviceAmount;
	if (typeof next.serviceCurrency === "string")
		mapped.serviceCurrency = next.serviceCurrency as Currency;
	if (typeof next.year === "number") mapped.year = next.year;
	session.updateClient(target.id, mapped);
};

export const executors: {
	[K in keyof typeof argSchemas]: (args: ArgsOf<K>) => Promise<ToolExecutionResult>;
} = {
	async createClient(args) {
		const created = await api.post<Client>("/api/clients", {
			templateId: args.templateId ?? null
		});
		session.aiInjectClient(created);
		return {
			inverse: inverseForCreateClient(created.id),
			summary: `Created client ${created.name || "(unnamed)"} (${created.id}).`
		};
	},

	async updateClient(args) {
		const before = snapshotClient(ensureClient(args.clientId));
		const patch = args.patch;
		if (patch.isActive !== undefined && patch.isActive !== before.isActive) {
			await session.setClientActive(args.clientId, patch.isActive);
		}
		const otherFields = { ...patch };
		delete otherFields.isActive;
		if (Object.keys(otherFields).length > 0) {
			await fillRemainingFields(args.clientId, otherFields);
		}
		return {
			inverse: inverseForUpdateClient(args.clientId, before),
			summary: `Updated client ${args.clientId}.`
		};
	},

	async deleteClient(args) {
		const before = snapshotClient(ensureClient(args.clientId));
		session.removeClient(args.clientId);
		return {
			inverse: inverseForDeleteClient(before),
			summary: `Deleted client ${before.name || args.clientId}.`
		};
	},

	async addInvoiceEntries(args) {
		ensureClient(args.clientId);
		const sorted = [...args.months].sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));
		const createdIds: string[] = [];
		for (const month of sorted) {
			const created = await api.post<InvoiceEntry>(`/api/clients/${args.clientId}/entries`, {
				month
			});
			session.aiAppendEntry(args.clientId, created);
			createdIds.push(created.id);
		}
		return {
			inverse: inverseForAddInvoiceEntries(args.clientId, createdIds),
			summary: `Added ${createdIds.length} invoice entr${createdIds.length === 1 ? "y" : "ies"}.`
		};
	},

	async updateInvoiceEntry(args) {
		const before = { ...ensureEntry(args.clientId, args.entryId) };
		const patch = args.patch;
		if (patch.month && patch.month !== before.month) {
			session.updateInvoiceEntry(args.clientId, args.entryId, "month", patch.month);
		}
		if (patch.issueDay !== undefined && patch.issueDay !== before.issueDay) {
			session.updateInvoiceEntry(args.clientId, args.entryId, "issueDay", patch.issueDay);
		}
		if (patch.dueDay !== undefined && patch.dueDay !== before.dueDay) {
			session.updateInvoiceEntry(args.clientId, args.entryId, "dueDay", patch.dueDay);
		}
		if (patch.isActive !== undefined && patch.isActive !== before.isActive) {
			await session.setInvoiceActive(args.clientId, args.entryId, patch.isActive);
		}
		return {
			inverse: inverseForUpdateInvoiceEntry(args.clientId, args.entryId, before),
			summary: `Updated invoice entry.`
		};
	},

	async removeInvoiceEntry(args) {
		const before = { ...ensureEntry(args.clientId, args.entryId) };
		session.removeInvoiceEntry(args.clientId, args.entryId);
		return {
			inverse: inverseForRemoveInvoiceEntry(args.clientId, before),
			summary: `Removed ${before.month} invoice.`
		};
	},

	async setClientActive(args) {
		const before = ensureClient(args.clientId);
		await session.setClientActive(args.clientId, args.isActive);
		return {
			inverse: inverseForSetActive("setClientActive", { clientId: args.clientId }, before.isActive),
			summary: `Marked client ${before.name || args.clientId} ${args.isActive ? "active" : "inactive"}.`
		};
	},

	async setInvoiceActive(args) {
		const before = ensureEntry(args.clientId, args.entryId);
		await session.setInvoiceActive(args.clientId, args.entryId, args.isActive);
		return {
			inverse: inverseForSetActive(
				"setInvoiceActive",
				{ clientId: args.clientId, entryId: args.entryId },
				before.isActive
			),
			summary: `Marked ${before.month} invoice ${args.isActive ? "active" : "inactive"}.`
		};
	},

	async togglePaymentMethod(args) {
		session.togglePaymentMethod(args.clientId, args.paymentMethodId);
		return {
			inverse: inverseForTogglePaymentMethod(args.clientId, args.paymentMethodId),
			summary: `Toggled payment method on client.`
		};
	},

	async reorderClientPaymentMethods(args) {
		const before = ensureClient(args.clientId).payment.methodIds.slice();
		await api.put<void>(`/api/clients/${args.clientId}/payment-methods`, {
			methodIds: args.orderedIds
		});
		session.aiApplyPaymentOrder(args.clientId, args.orderedIds);
		return {
			inverse: inverseForReorderClientPaymentMethods(args.clientId, before),
			summary: `Reordered payment methods.`
		};
	},

	async updateFixedField(args) {
		const previous = fixed.value.from[args.field as "name" | "phone" | "email" | "address"];
		fixed.updateFrom(args.field as "name" | "phone" | "email" | "address", args.value);
		return {
			inverse: inverseForUpdateFixedField(args.field, previous),
			summary: `Updated sender ${args.field}.`
		};
	},

	async addPaymentMethod(args) {
		const newId = await fixed.addPaymentMethod(args.kind as PaymentMethodKind);
		if (!newId) throw new Error("Failed to create payment method");
		return {
			inverse: inverseForAddPaymentMethod(newId),
			summary: `Added ${args.kind} payment method.`
		};
	},

	async updatePaymentMethodValue(args) {
		const method = ensureMethod(args.paymentMethodId);
		const previous = method.values[args.field] ?? "";
		fixed.updatePaymentMethodValue(args.paymentMethodId, args.field, args.value);
		return {
			inverse: inverseForUpdatePaymentMethodValue(args.paymentMethodId, args.field, previous),
			summary: `Updated payment method value (${args.field}).`
		};
	},

	async updatePaymentMethodLabel(args) {
		const method = ensureMethod(args.paymentMethodId);
		const previousLabel = method.label;
		fixed.updatePaymentMethodLabel(args.paymentMethodId, args.label);
		return {
			inverse: inverseForUpdatePaymentMethodLabel(args.paymentMethodId, previousLabel),
			summary: `Renamed payment method.`
		};
	},

	async removePaymentMethod(args) {
		const method = ensureMethod(args.paymentMethodId);
		const snapshot = snapshotPaymentMethod(method);
		const usedBy = session.clients
			.filter((c) => c.payment.methodIds.includes(args.paymentMethodId))
			.map((c) => c.id);
		fixed.removePaymentMethod(args.paymentMethodId);
		session.purgePaymentMethodFromClients(args.paymentMethodId);
		return {
			inverse: inverseForRemovePaymentMethod(snapshot, usedBy),
			summary: `Removed payment method ${snapshot.label || snapshot.kind}.`
		};
	},

	async movePaymentMethod(args) {
		fixed.movePaymentMethod(args.paymentMethodId, args.direction);
		return {
			inverse: inverseForMovePaymentMethod(args.paymentMethodId, args.direction),
			summary: `Moved payment method ${args.direction === 1 ? "down" : "up"}.`
		};
	},

	async polishText(args) {
		if (args.target === "clientServiceDescription") {
			if (!args.clientId) throw new Error("polishText requires clientId for service description");
			const client = ensureClient(args.clientId);
			const previous = client.service.description;
			session.updateClient(args.clientId, { serviceDescription: args.proposedText });
			return {
				inverse: inverseForPolishText(args.target, args.clientId, undefined, previous),
				summary: `Rewrote service description for ${client.name || args.clientId}.`
			};
		}
		if (args.target === "paymentMethodLabel") {
			if (!args.paymentMethodId) throw new Error("polishText requires paymentMethodId");
			const method = ensureMethod(args.paymentMethodId);
			const previous = method.label;
			fixed.updatePaymentMethodLabel(args.paymentMethodId, args.proposedText);
			return {
				inverse: inverseForPolishText(args.target, undefined, args.paymentMethodId, previous),
				summary: `Rewrote payment method label.`
			};
		}
		const map: Record<string, keyof typeof fixed.value.from> = {
			fromName: "name",
			fromPhone: "phone",
			fromEmail: "email",
			fromAddress: "address"
		};
		const field = map[args.target];
		if (!field) throw new Error(`Unsupported polishText target: ${args.target}`);
		const previous = fixed.value.from[field];
		fixed.updateFrom(field, args.proposedText);
		return {
			inverse: inverseForPolishText(args.target, undefined, undefined, previous),
			summary: `Rewrote sender ${field}.`
		};
	},

	async setSelectedClientId(args) {
		const previous = session.selectedClientId;
		session.setSelectedClientId(args.clientId);
		return {
			inverse: inverseForSetSelectedClientId(previous),
			summary: args.clientId ? `Selected client ${args.clientId}.` : `Cleared selection.`
		};
	}
};
