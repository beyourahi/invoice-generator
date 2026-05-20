import { z } from "zod";
import { MONTHS } from "$lib/invoice/months";
import type { MonthName, PaymentMethodKind } from "$lib/types";

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
	reorderPaymentMethods: z.object({
		orderedIds: z.array(z.string()).max(32)
	}),
	polishText: z.object({
		target: z.enum(POLISH_TARGETS),
		clientId: z.string().optional(),
		paymentMethodId: z.string().optional(),
		proposedText: z.string().min(1).max(4000)
	}),
	setSelectedClientId: z.object({ clientId: z.string().nullable() }),
	getAppStateSummary: z.object({}).default({})
} as const;

export type ArgsOf<K extends keyof typeof argSchemas> = z.infer<(typeof argSchemas)[K]>;

export const isKnownToolName = (name: string): name is keyof typeof argSchemas =>
	name in argSchemas;
