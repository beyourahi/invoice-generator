import { error } from "@sveltejs/kit";
import { z } from "zod";
import type { RequestHandler } from "./$types";
import { requireApiContext, parseJson, ok } from "$lib/server/api";
import {
	accountHasData,
	importGuestSnapshot,
	type GuestImportSnapshot
} from "$lib/server/repositories/import";

const savedPaymentMethodSchema = z.object({
	id: z.string(),
	kind: z.string(),
	label: z.string().optional().default(""),
	values: z.record(z.string(), z.string()).optional().default({})
});

const invoiceEntrySchema = z.object({
	id: z.string(),
	month: z.string(),
	issueDay: z.string().optional().default("01"),
	dueDay: z.string().optional().default("07"),
	isActive: z.boolean().optional().default(true)
});

const clientSchema = z.object({
	id: z.string(),
	name: z.string().optional().default(""),
	invoicePrefix: z.string().optional().default(""),
	phone: z.string().optional().default(""),
	email: z.string().optional().default(""),
	address: z.array(z.string()).optional().default([""]),
	service: z.object({
		description: z.string().optional().default(""),
		amount: z.number().optional().default(0),
		currency: z.string().optional().default("BDT")
	}),
	payment: z.object({ methodIds: z.array(z.string()).optional().default([]) }),
	year: z.number(),
	isActive: z.boolean().optional().default(true),
	invoices: z.array(invoiceEntrySchema).optional().default([]),
	createdAt: z.string().optional()
});

const bodySchema = z.object({
	fixed: z
		.object({
			from: z.object({
				name: z.string().optional().default(""),
				phone: z.string().optional().default(""),
				email: z.string().optional().default(""),
				address: z.string().optional().default("")
			}),
			paymentMethods: z.array(savedPaymentMethodSchema).optional().default([])
		})
		.nullable()
		.optional()
		.default(null),
	session: z
		.object({
			clients: z.array(clientSchema).optional().default([]),
			selectedClientId: z.string().nullable().optional().default(null),
			expandedClients: z.record(z.string(), z.boolean()).optional().default({})
		})
		.nullable()
		.optional()
		.default(null)
});

/**
 * POST /api/import — one-shot atomic import of a guest snapshot on first sign-in.
 * Writes everything in a single D1 batch (all-or-nothing). Returns 409 when the
 * account already holds data so a populated account is never overwritten/merged.
 */
export const POST: RequestHandler = async (event) => {
	const { db, userId } = requireApiContext(event);
	const body = await parseJson(event, bodySchema);

	if (await accountHasData(db, userId)) {
		throw error(409, "Account already has data");
	}

	await importGuestSnapshot(db, userId, body as unknown as GuestImportSnapshot);
	return ok({ imported: true });
};
