import { and, asc, eq, sql, max } from "drizzle-orm";
import type { Database } from "../db";
import { paymentMethods, clientPaymentMethods, clients } from "../schema";
import type { PaymentMethodKind } from "$lib/types";
import { createSavedMethod, getMethodDef } from "$lib/payments/registry";
import { toSavedPaymentMethod } from "../dto";

export const listMethodsByUser = async (db: Database, userId: string) => {
	const rows = await db
		.select()
		.from(paymentMethods)
		.where(eq(paymentMethods.userId, userId))
		.orderBy(asc(paymentMethods.position), asc(paymentMethods.createdAt))
		.all();
	return rows.map(toSavedPaymentMethod);
};

const nextPosition = async (db: Database, userId: string): Promise<number> => {
	const result = await db
		.select({ value: max(paymentMethods.position) })
		.from(paymentMethods)
		.where(eq(paymentMethods.userId, userId))
		.get();
	const current = result?.value;
	return typeof current === "number" ? current + 1 : 0;
};

export const createPaymentMethod = async (
	db: Database,
	userId: string,
	kind: PaymentMethodKind
) => {
	const def = getMethodDef(kind);
	const seed = createSavedMethod(kind);
	const existingCount = await db
		.select({ value: sql<number>`COUNT(*)` })
		.from(paymentMethods)
		.where(and(eq(paymentMethods.userId, userId), eq(paymentMethods.kind, kind)))
		.get();
	const count = existingCount?.value ?? 0;
	const label = count > 0 ? `${def.name} ${count + 1}` : def.name;
	const position = await nextPosition(db, userId);

	await db
		.insert(paymentMethods)
		.values({
			id: seed.id,
			userId,
			kind,
			label,
			values: seed.values,
			position
		})
		.run();

	return { ...seed, label };
};

export interface MethodPatch {
	label?: string;
	value?: { key: string; value: string };
}

export const updatePaymentMethod = async (
	db: Database,
	userId: string,
	id: string,
	patch: MethodPatch
) => {
	const existing = await db
		.select()
		.from(paymentMethods)
		.where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)))
		.get();
	if (!existing) return null;

	const fields: Record<string, unknown> = { updatedAt: sql`(unixepoch())` };
	if (patch.label !== undefined) fields.label = patch.label;
	if (patch.value !== undefined) {
		const next = { ...(existing.values ?? {}), [patch.value.key]: patch.value.value };
		fields.values = next;
	}

	await db
		.update(paymentMethods)
		.set(fields)
		.where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)))
		.run();
	return true;
};

export const deletePaymentMethod = async (db: Database, userId: string, id: string) => {
	await db
		.delete(paymentMethods)
		.where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)))
		.run();
};

export const reorderPaymentMethods = async (
	db: Database,
	userId: string,
	orderedIds: string[]
) => {
	const stmts = orderedIds.map((id, position) =>
		db
			.update(paymentMethods)
			.set({ position, updatedAt: sql`(unixepoch())` })
			.where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)))
	);
	if (stmts.length === 0) return;
	await db.batch(stmts as [(typeof stmts)[number], ...(typeof stmts)[number][]]);
};

export const purgeMethodFromAllClients = async (
	db: Database,
	userId: string,
	methodId: string
) => {
	const userClientIds = await db
		.select({ id: clients.id })
		.from(clients)
		.where(eq(clients.userId, userId))
		.all();
	if (userClientIds.length === 0) return;
	const ids = userClientIds.map((c) => c.id);
	for (const cid of ids) {
		await db
			.delete(clientPaymentMethods)
			.where(
				and(
					eq(clientPaymentMethods.clientId, cid),
					eq(clientPaymentMethods.paymentMethodId, methodId)
				)
			)
			.run();
	}
};
