import { z } from "zod";
import { PAYMENT_METHOD_KINDS } from "$lib/payments/registry";
import { MONTHS } from "$lib/invoice/months";
import type { MonthName, PaymentMethodKind } from "$lib/types";

export const paymentKindSchema: z.ZodType<PaymentMethodKind> = z.enum(
	PAYMENT_METHOD_KINDS as [PaymentMethodKind, ...PaymentMethodKind[]]
);

export const monthSchema: z.ZodType<MonthName> = z.enum(MONTHS as [MonthName, ...MonthName[]]);

export const dayStringSchema = z
	.string()
	.regex(/^\d{0,2}$/, "Day must be up to 2 digits")
	.max(2);

export const fromPatchSchema = z
	.object({
		name: z.string().max(200).optional(),
		phone: z.string().max(60).optional(),
		email: z.string().max(200).optional(),
		address: z.string().max(2000).optional()
	})
	.refine((v) => Object.keys(v).length > 0, { message: "Empty patch" });

export const setSelectedSchema = z.object({
	selectedClientId: z.string().nullable()
});

export const createMethodSchema = z.object({
	kind: paymentKindSchema
});

export const updateMethodSchema = z
	.object({
		label: z.string().max(120).optional(),
		valueKey: z.string().max(120).optional(),
		valueValue: z.string().max(2000).optional()
	})
	.refine(
		(v) => v.label !== undefined || (v.valueKey !== undefined && v.valueValue !== undefined),
		{ message: "Provide label or valueKey+valueValue" }
	);

export const reorderSchema = z.object({
	orderedIds: z.array(z.string()).max(64)
});

export const createClientSchema = z.object({
	templateId: z.string().nullable().optional()
});

export const updateClientSchema = z
	.object({
		name: z.string().max(200).optional(),
		invoicePrefix: z.string().max(40).optional(),
		phone: z.string().max(60).optional(),
		email: z.string().max(200).optional(),
		address: z.array(z.string().max(2000)).max(8).optional(),
		serviceDescription: z.string().max(2000).optional(),
		serviceAmount: z.number().min(0).max(1_000_000_000).optional(),
		serviceCurrency: z.enum(["BDT", "USD"]).optional(),
		year: z.number().int().min(2000).max(2099).optional(),
		expanded: z.boolean().optional()
	})
	.refine((v) => Object.keys(v).length > 0, { message: "Empty patch" });

export const setClientMethodsSchema = z.object({
	methodIds: z.array(z.string()).max(32)
});

export const createEntrySchema = z.object({
	month: monthSchema.optional()
});

export const updateEntrySchema = z
	.object({
		month: monthSchema.optional(),
		issueDay: dayStringSchema.optional(),
		dueDay: dayStringSchema.optional()
	})
	.refine((v) => Object.keys(v).length > 0, { message: "Empty patch" });
