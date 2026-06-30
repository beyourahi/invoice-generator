/**
 * Atomic first-sign-in import of a guest's localStorage snapshot into their D1
 * account. Every row (sender, payment methods, clients, entries, links) is written
 * in ONE D1 `db.batch([...])` — which commits all-or-nothing — so a mid-flight
 * failure leaves the account empty and the caller's accountEmpty guard correctly
 * permits a clean retry on the next load (no partial state, no duplicates). Guest
 * client-side ids are remapped to fresh server ids; client→method links reference
 * the NEW method ids. @see src/routes/api/import/+server.ts, $lib/persistence/migrate.ts.
 */
import { eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Database } from "../db";
import {
	clients,
	clientPaymentMethods,
	fixedSettings,
	invoiceEntries,
	paymentMethods
} from "../schema";
import type { Currency, Fixed } from "$lib/types";
import type { GuestSessionSnapshot } from "$lib/persistence/keys";

export interface GuestImportSnapshot {
	fixed: Fixed | null;
	session: GuestSessionSnapshot | null;
}

/** True when the account already holds importable data (clients, methods, sender, or selection). */
export const accountHasData = async (db: Database, userId: string): Promise<boolean> => {
	const [client, method, fixedRow] = await Promise.all([
		db.select({ id: clients.id }).from(clients).where(eq(clients.userId, userId)).get(),
		db
			.select({ id: paymentMethods.id })
			.from(paymentMethods)
			.where(eq(paymentMethods.userId, userId))
			.get(),
		db.select().from(fixedSettings).where(eq(fixedSettings.userId, userId)).get()
	]);
	const fixedHasData =
		!!fixedRow &&
		(!!fixedRow.fromName ||
			!!fixedRow.fromPhone ||
			!!fixedRow.fromEmail ||
			!!fixedRow.fromAddress ||
			!!fixedRow.selectedClientId);
	return !!client || !!method || fixedHasData;
};

/**
 * Replays the guest snapshot into the user's account in a single atomic batch.
 * Caller MUST verify accountHasData() === false first (this does not re-check).
 */
export const importGuestSnapshot = async (
	db: Database,
	userId: string,
	snapshot: GuestImportSnapshot
): Promise<void> => {
	const now = new Date();
	const statements: BatchItem<"sqlite">[] = [];

	// Payment methods — remap guest id → new server id.
	const methodIdMap = new Map<string, string>();
	(snapshot.fixed?.paymentMethods ?? []).forEach((m, i) => {
		const newId = crypto.randomUUID();
		methodIdMap.set(m.id, newId);
		statements.push(
			db.insert(paymentMethods).values({
				id: newId,
				userId,
				kind: m.kind,
				label: m.label ?? "",
				values: m.values ?? {},
				position: i,
				createdAt: now,
				updatedAt: now
			})
		);
	});

	// Clients (+ entries + method links) — remap guest id → new server id.
	const clientIdMap = new Map<string, string>();
	(snapshot.session?.clients ?? []).forEach((c, ci) => {
		const newId = crypto.randomUUID();
		clientIdMap.set(c.id, newId);
		statements.push(
			db.insert(clients).values({
				id: newId,
				userId,
				name: c.name ?? "",
				invoicePrefix: c.invoicePrefix ?? "",
				phone: c.phone ?? "",
				email: c.email ?? "",
				address: c.address ?? [""],
				serviceDescription: c.service?.description ?? "",
				serviceAmount: c.service?.amount ?? 0,
				serviceCurrency: (c.service?.currency ?? "BDT") as Currency,
				year: c.year ?? now.getFullYear(),
				expanded: snapshot.session?.expandedClients[c.id] ?? true,
				isActive: c.isActive ?? true,
				position: ci,
				createdAt: now,
				updatedAt: now
			})
		);
		(c.invoices ?? []).forEach((e, ei) => {
			statements.push(
				db.insert(invoiceEntries).values({
					id: crypto.randomUUID(),
					clientId: newId,
					month: e.month,
					issueDay: e.issueDay ?? "01",
					dueDay: e.dueDay ?? "07",
					isActive: e.isActive ?? true,
					position: ei,
					createdAt: now
				})
			);
		});
		(c.payment?.methodIds ?? [])
			.map((id) => methodIdMap.get(id))
			.filter((id): id is string => Boolean(id))
			.forEach((mid, i) => {
				statements.push(
					db.insert(clientPaymentMethods).values({
						clientId: newId,
						paymentMethodId: mid,
						position: i
					})
				);
			});
	});

	// Sender identity + remapped selected client.
	const from = snapshot.fixed?.from;
	const selectedClientId = snapshot.session?.selectedClientId
		? (clientIdMap.get(snapshot.session.selectedClientId) ?? null)
		: null;
	if (from || selectedClientId) {
		statements.push(
			db.insert(fixedSettings).values({
				userId,
				fromName: from?.name ?? "",
				fromPhone: from?.phone ?? "",
				fromEmail: from?.email ?? "",
				fromAddress: from?.address ?? "",
				selectedClientId,
				updatedAt: now
			})
		);
	}

	if (statements.length === 0) return;
	await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
};
