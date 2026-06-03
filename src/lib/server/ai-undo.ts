/**
 * Server-side reversal of an applied AI Copilot action ("undo").
 * Each executed tool stores an InverseRecord (a reverse tool call + optional snapshot);
 * applyInverse re-executes that reverse call against D1.
 * INVARIANT: the inverse vocabulary here must stay in lockstep with $lib/ai/inverse.ts —
 * every tool that produces an inverse must have a matching case below, or undo breaks silently.
 * INVARIANT: snapshot-based restore inverses regenerate fresh row IDs (the original rows are
 * gone), so restored entities are not identity-equal to the deleted originals.
 */
import type { Database } from "./db";
import type { Currency, MonthName, PaymentMethodKind } from "$lib/types";
import {
	deleteClient,
	deleteInvoiceEntry,
	setClientPaymentMethods,
	updateClient,
	updateInvoiceEntry
} from "./repositories/clients";
import {
	createPaymentMethod,
	deletePaymentMethod,
	reorderPaymentMethods,
	updatePaymentMethod
} from "./repositories/payment-methods";
import { setSelectedClientId, upsertFrom } from "./repositories/fixed";
import { listMethodsByUser } from "./repositories/payment-methods";
import { listClientsByUser } from "./repositories/clients";
import { clients, invoiceEntries, paymentMethods } from "./schema";
import { and, eq, sql } from "drizzle-orm";

/** Thrown when an undo cannot proceed because the target row no longer exists or the
 * inverse is malformed. Callers map this to a user-facing "can't undo" state rather than a crash. */
export class UndoInvalidatedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "UndoInvalidatedError";
	}
}

/** Allowlist of inverse tool names accepted by validateInverse/applyInverse. Persisted
 * action.inverse.tool is untrusted input; only these names may execute. */
export const KNOWN_INVERSE_TOOLS = new Set([
	"noop",
	"deleteClient",
	"updateClient",
	"restoreClient",
	"deleteInvoiceEntries",
	"updateInvoiceEntry",
	"restoreInvoiceEntry",
	"setClientActive",
	"setInvoiceActive",
	"togglePaymentMethod",
	"reorderClientPaymentMethods",
	"updateFixedField",
	"addPaymentMethod",
	"removePaymentMethod",
	"restorePaymentMethod",
	"updatePaymentMethodValue",
	"updatePaymentMethodLabel",
	"reorderPaymentMethods",
	"setSelectedClientId",
	"polishText"
]);

/** Restore-style inverses that recreate a deleted row and therefore REQUIRE a snapshot
 * payload; validateInverse rejects them if snapshot is absent. */
const SNAPSHOT_REQUIRED_INVERSES = new Set([
	"restoreClient",
	"restoreInvoiceEntry",
	"restorePaymentMethod"
]);

/** Structural gate run on the persisted inverse before applyInverse. Verifies the tool is
 * allowlisted, args is a plain object, and snapshot is present for restore inverses.
 * Does NOT validate arg field shapes — applyInverse coerces those per-case. */
export const validateInverse = (inverse: unknown): boolean => {
	if (!inverse || typeof inverse !== "object" || Array.isArray(inverse)) return false;
	const record = inverse as Record<string, unknown>;
	if (typeof record.tool !== "string" || !KNOWN_INVERSE_TOOLS.has(record.tool)) return false;
	if (!record.args || typeof record.args !== "object" || Array.isArray(record.args)) return false;
	if (
		SNAPSHOT_REQUIRED_INVERSES.has(record.tool) &&
		(!record.snapshot || typeof record.snapshot !== "object")
	) {
		return false;
	}
	return true;
};

interface InverseShape {
	tool: string;
	args: unknown;
	snapshot?: unknown;
}

const asString = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

const asStringArray = (v: unknown): string[] =>
	Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];

const ensureClientExists = async (db: Database, userId: string, clientId: string) => {
	const row = await db
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
		.get();
	if (!row) {
		throw new UndoInvalidatedError("Client no longer exists.");
	}
};

const ensureEntryExists = async (db: Database, clientId: string, entryId: string) => {
	const row = await db
		.select({ id: invoiceEntries.id })
		.from(invoiceEntries)
		.where(and(eq(invoiceEntries.id, entryId), eq(invoiceEntries.clientId, clientId)))
		.get();
	if (!row) {
		throw new UndoInvalidatedError("Invoice entry no longer exists.");
	}
};

const insertClientFromSnapshot = async (
	db: Database,
	userId: string,
	snapshot: Record<string, unknown>
): Promise<string> => {
	const id = crypto.randomUUID();
	const now = new Date();
	await db
		.insert(clients)
		.values({
			id,
			userId,
			name: asString(snapshot.name) ?? "",
			invoicePrefix: asString(snapshot.invoicePrefix) ?? "",
			phone: asString(snapshot.phone) ?? "",
			email: asString(snapshot.email) ?? "",
			address: Array.isArray(snapshot.address) ? (snapshot.address as string[]) : [""],
			serviceDescription: asString(snapshot.serviceDescription) ?? "",
			serviceAmount: typeof snapshot.serviceAmount === "number" ? snapshot.serviceAmount : 0,
			serviceCurrency: (asString(snapshot.serviceCurrency) as Currency) ?? ("BDT" as Currency),
			year: typeof snapshot.year === "number" ? snapshot.year : new Date().getFullYear(),
			expanded: true,
			isActive: typeof snapshot.isActive === "boolean" ? snapshot.isActive : true,
			position: 0,
			createdAt: now,
			updatedAt: now
		})
		.run();

	const paymentMethodIds = asStringArray(snapshot.paymentMethodIds);
	if (paymentMethodIds.length > 0) {
		await setClientPaymentMethods(db, userId, id, paymentMethodIds);
	}

	const invoices = Array.isArray(snapshot.invoices)
		? (snapshot.invoices as Array<Record<string, unknown>>)
		: [];
	for (const e of invoices) {
		const eid = crypto.randomUUID();
		await db
			.insert(invoiceEntries)
			.values({
				id: eid,
				clientId: id,
				month: (asString(e.month) ?? "January") as MonthName,
				issueDay: asString(e.issueDay) ?? "01",
				dueDay: asString(e.dueDay) ?? "07",
				isActive: typeof e.isActive === "boolean" ? e.isActive : true,
				position: 0,
				createdAt: new Date()
			})
			.run();
	}
	return id;
};

const insertEntryFromSnapshot = async (
	db: Database,
	clientId: string,
	snapshot: Record<string, unknown>
): Promise<void> => {
	await db
		.insert(invoiceEntries)
		.values({
			id: crypto.randomUUID(),
			clientId,
			month: (asString(snapshot.month) ?? "January") as MonthName,
			issueDay: asString(snapshot.issueDay) ?? "01",
			dueDay: asString(snapshot.dueDay) ?? "07",
			isActive: typeof snapshot.isActive === "boolean" ? snapshot.isActive : true,
			position: 0,
			createdAt: new Date()
		})
		.run();
};

/** Recreates a deleted payment method (reusing its original id when present in the snapshot)
 * and re-links it to the clients that referenced it, appending to each client's current method
 * list rather than replacing it. Skips clients that no longer exist. */
const insertPaymentMethodFromSnapshot = async (
	db: Database,
	userId: string,
	snapshot: Record<string, unknown>,
	usedByClientIds: string[]
): Promise<string> => {
	const id = asString(snapshot.id) ?? crypto.randomUUID();
	const now = new Date();
	await db
		.insert(paymentMethods)
		.values({
			id,
			userId,
			kind: (asString(snapshot.kind) as PaymentMethodKind) ?? ("custom" as PaymentMethodKind),
			label: asString(snapshot.label) ?? "",
			values: (snapshot.values as Record<string, string>) ?? {},
			position: 0,
			createdAt: now,
			updatedAt: now
		})
		.run();
	for (const clientId of usedByClientIds) {
		const current = await db
			.select({ id: clients.id })
			.from(clients)
			.where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
			.get();
		if (!current) continue;
		await setClientPaymentMethods(db, userId, clientId, [
			...(await currentClientMethodIds(db, clientId)),
			id
		]);
	}
	return id;
};

const currentClientMethodIds = async (db: Database, clientId: string): Promise<string[]> => {
	const rows = await db.query.clientPaymentMethods.findMany({
		where: (m, { eq: eqHelper }) => eqHelper(m.clientId, clientId),
		orderBy: (m, { asc: ascHelper }) => ascHelper(m.position)
	});
	return rows.map((r) => r.paymentMethodId);
};

/**
 * Executes the reverse tool call recorded for an action. SIDE EFFECT: writes to D1.
 * INVARIANT: every case must exist for each inverse tool emitted by $lib/ai/inverse.ts.
 * Each case re-validates the target's existence first and throws UndoInvalidatedError if gone.
 * @throws UndoInvalidatedError on missing target, bad args, or unknown tool.
 */
export const applyInverse = async (
	db: Database,
	userId: string,
	inverse: InverseShape
): Promise<void> => {
	const args = (inverse.args as Record<string, unknown>) ?? {};

	switch (inverse.tool) {
		case "noop":
			return;

		case "deleteClient": {
			const clientId = asString(args.clientId);
			if (!clientId) throw new UndoInvalidatedError("Missing clientId for deleteClient inverse");
			await ensureClientExists(db, userId, clientId);
			await deleteClient(db, userId, clientId);
			return;
		}

		case "updateClient": {
			const clientId = asString(args.clientId);
			const patch = (args.patch as Record<string, unknown>) ?? {};
			if (!clientId) throw new UndoInvalidatedError("Missing clientId");
			await ensureClientExists(db, userId, clientId);
			await updateClient(db, userId, clientId, {
				name: asString(patch.name),
				invoicePrefix: asString(patch.invoicePrefix),
				phone: asString(patch.phone),
				email: asString(patch.email),
				address: Array.isArray(patch.address) ? (patch.address as string[]) : undefined,
				serviceDescription: asString(patch.serviceDescription),
				serviceAmount: typeof patch.serviceAmount === "number" ? patch.serviceAmount : undefined,
				serviceCurrency: (asString(patch.serviceCurrency) as Currency) ?? undefined,
				year: typeof patch.year === "number" ? patch.year : undefined,
				isActive: typeof patch.isActive === "boolean" ? patch.isActive : undefined
			});
			return;
		}

		case "restoreClient": {
			const snapshot = (inverse.snapshot as Record<string, unknown> | undefined) ?? {};
			await insertClientFromSnapshot(db, userId, snapshot);
			return;
		}

		case "deleteInvoiceEntries": {
			const clientId = asString(args.clientId);
			const entryIds = asStringArray(args.entryIds);
			if (!clientId) throw new UndoInvalidatedError("Missing clientId");
			for (const eid of entryIds) {
				await ensureEntryExists(db, clientId, eid);
			}
			for (const eid of entryIds) {
				await deleteInvoiceEntry(db, userId, clientId, eid);
			}
			return;
		}

		case "updateInvoiceEntry": {
			const clientId = asString(args.clientId);
			const entryId = asString(args.entryId);
			const patch = (args.patch as Record<string, unknown>) ?? {};
			if (!clientId || !entryId) throw new UndoInvalidatedError("Missing ids");
			await ensureEntryExists(db, clientId, entryId);
			await updateInvoiceEntry(db, userId, clientId, entryId, {
				month: (asString(patch.month) as MonthName) ?? undefined,
				issueDay: asString(patch.issueDay),
				dueDay: asString(patch.dueDay),
				isActive: typeof patch.isActive === "boolean" ? patch.isActive : undefined
			});
			return;
		}

		case "restoreInvoiceEntry": {
			const clientId = asString(args.clientId);
			const snapshot = (inverse.snapshot as Record<string, unknown> | undefined) ?? {};
			if (!clientId) throw new UndoInvalidatedError("Missing clientId");
			await ensureClientExists(db, userId, clientId);
			await insertEntryFromSnapshot(db, clientId, snapshot);
			return;
		}

		case "setClientActive": {
			const clientId = asString(args.clientId);
			const isActive = typeof args.isActive === "boolean" ? args.isActive : undefined;
			if (!clientId || isActive === undefined) throw new UndoInvalidatedError("Bad args");
			await ensureClientExists(db, userId, clientId);
			await updateClient(db, userId, clientId, { isActive });
			return;
		}

		case "setInvoiceActive": {
			const clientId = asString(args.clientId);
			const entryId = asString(args.entryId);
			const isActive = typeof args.isActive === "boolean" ? args.isActive : undefined;
			if (!clientId || !entryId || isActive === undefined)
				throw new UndoInvalidatedError("Bad args");
			await ensureEntryExists(db, clientId, entryId);
			await updateInvoiceEntry(db, userId, clientId, entryId, { isActive });
			return;
		}

		case "togglePaymentMethod": {
			const clientId = asString(args.clientId);
			const paymentMethodId = asString(args.paymentMethodId);
			if (!clientId || !paymentMethodId) throw new UndoInvalidatedError("Bad args");
			await ensureClientExists(db, userId, clientId);
			const current = await currentClientMethodIds(db, clientId);
			const next = current.includes(paymentMethodId)
				? current.filter((id) => id !== paymentMethodId)
				: [...current, paymentMethodId];
			await setClientPaymentMethods(db, userId, clientId, next);
			return;
		}

		case "reorderClientPaymentMethods": {
			const clientId = asString(args.clientId);
			const orderedIds = asStringArray(args.orderedIds);
			if (!clientId) throw new UndoInvalidatedError("Bad args");
			await ensureClientExists(db, userId, clientId);
			await setClientPaymentMethods(db, userId, clientId, orderedIds);
			return;
		}

		case "updateFixedField": {
			const field = asString(args.field);
			const value = asString(args.value);
			if (!field || value === undefined) throw new UndoInvalidatedError("Bad args");
			await upsertFrom(db, userId, { [field]: value });
			return;
		}

		case "addPaymentMethod": {
			const kind = asString(args.kind) as PaymentMethodKind | undefined;
			if (!kind) throw new UndoInvalidatedError("Bad args");
			await createPaymentMethod(db, userId, kind);
			return;
		}

		case "removePaymentMethod": {
			const paymentMethodId = asString(args.paymentMethodId);
			if (!paymentMethodId) throw new UndoInvalidatedError("Bad args");
			await deletePaymentMethod(db, userId, paymentMethodId);
			return;
		}

		case "restorePaymentMethod": {
			const snapshot = (inverse.snapshot as Record<string, unknown> | undefined) ?? {};
			const usedByClientIds = asStringArray(args.usedByClientIds);
			await insertPaymentMethodFromSnapshot(db, userId, snapshot, usedByClientIds);
			return;
		}

		case "updatePaymentMethodValue": {
			const paymentMethodId = asString(args.paymentMethodId);
			const field = asString(args.field);
			const value = asString(args.value);
			if (!paymentMethodId || !field || value === undefined)
				throw new UndoInvalidatedError("Bad args");
			await updatePaymentMethod(db, userId, paymentMethodId, {
				value: { key: field, value }
			});
			return;
		}

		case "updatePaymentMethodLabel": {
			const paymentMethodId = asString(args.paymentMethodId);
			const label = asString(args.label);
			if (!paymentMethodId || label === undefined) throw new UndoInvalidatedError("Bad args");
			await updatePaymentMethod(db, userId, paymentMethodId, { label });
			return;
		}

		case "reorderPaymentMethods": {
			const orderedIds = asStringArray(args.orderedIds);
			if (orderedIds.length === 0) throw new UndoInvalidatedError("Bad args");
			await reorderPaymentMethods(db, userId, orderedIds);
			return;
		}

		case "setSelectedClientId": {
			const clientId = args.clientId === null ? null : (asString(args.clientId) ?? null);
			await setSelectedClientId(db, userId, clientId);
			return;
		}

		// Reverses an AI text-polish by writing proposedText (the pre-polish value) back to
		// whichever target field the polish touched; target string selects client/payment/fixed.
		case "polishText": {
			const target = asString(args.target);
			const proposedText = asString(args.proposedText) ?? "";
			const clientId = asString(args.clientId);
			const paymentMethodId = asString(args.paymentMethodId);
			if (target === "clientServiceDescription" && clientId) {
				await ensureClientExists(db, userId, clientId);
				await updateClient(db, userId, clientId, { serviceDescription: proposedText });
				return;
			}
			if (target === "paymentMethodLabel" && paymentMethodId) {
				await updatePaymentMethod(db, userId, paymentMethodId, { label: proposedText });
				return;
			}
			if (target && ["fromName", "fromPhone", "fromEmail", "fromAddress"].includes(target)) {
				const map: Record<string, "name" | "phone" | "email" | "address"> = {
					fromName: "name",
					fromPhone: "phone",
					fromEmail: "email",
					fromAddress: "address"
				};
				await upsertFrom(db, userId, { [map[target]]: proposedText });
				return;
			}
			throw new UndoInvalidatedError(`Unknown polishText target: ${target}`);
		}

		default:
			throw new UndoInvalidatedError(`Unknown inverse tool: ${inverse.tool}`);
	}
};

/** Fetches the user's payment methods and clients together for anomaly checks during undo. */
export const loadStateSlice = async (db: Database, userId: string) => {
	const [methods, clientList] = await Promise.all([
		listMethodsByUser(db, userId),
		listClientsByUser(db, userId)
	]);
	return { methods, clientList };
};

export { sql };
