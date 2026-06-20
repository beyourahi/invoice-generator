/**
 * One-time import of a guest's localStorage snapshot into their account on first
 * sign-in. Replays the guest sender, payment methods, clients, entries, and links
 * through the EXISTING authed REST API (no bespoke server endpoint), remapping the
 * guest's client-side ids to server-assigned ids as it goes — critically, client→
 * payment-method links must reference the NEW method ids.
 *
 * Runs only when the account is empty (fresh user), so it never merges into or
 * clobbers existing account data; a populated account simply keeps its own data
 * and the guest snapshot is left untouched. On full success the guest keys are
 * cleared and the caller reloads so the server load re-hydrates the stores from
 * D1. Any failure aborts and retains the guest data for a later retry.
 */
import { api } from "$lib/api/client";
import type { Client, Fixed, InvoiceEntry, SavedPaymentMethod } from "$lib/types";
import { readLocal, clearLocal } from "./local";
import { GUEST_FIXED_KEY, GUEST_SESSION_KEY, type GuestSessionSnapshot } from "./keys";

export const hasGuestData = (): boolean =>
	readLocal(GUEST_FIXED_KEY) !== null || readLocal(GUEST_SESSION_KEY) !== null;

/**
 * @param accountEmpty true when the freshly-loaded account holds no data.
 * @returns true when an import completed (caller should reload), false otherwise.
 */
export const migrateGuestToServer = async (accountEmpty: boolean): Promise<boolean> => {
	const guestFixed = readLocal<Fixed>(GUEST_FIXED_KEY);
	const guestSession = readLocal<GuestSessionSnapshot>(GUEST_SESSION_KEY);
	if (!guestFixed && !guestSession) return false;
	// Don't merge into an existing account — keep the guest snapshot for now.
	if (!accountEmpty) return false;

	try {
		// 1. Sender identity (one PATCH; the endpoint accepts the from.* keys).
		if (guestFixed) {
			const { name, phone, email, address } = guestFixed.from;
			if (name || phone || email || address) {
				await api.patch<void>("/api/fixed", { name, phone, email, address });
			}
		}

		// 2. Payment methods — create each, capture the new id, replay label/values.
		const methodIdMap = new Map<string, string>();
		for (const m of guestFixed?.paymentMethods ?? []) {
			const created = await api.post<SavedPaymentMethod>("/api/payment-methods", { kind: m.kind });
			methodIdMap.set(m.id, created.id);
			if (m.label && m.label !== created.label) {
				await api.patch<void>(`/api/payment-methods/${created.id}`, { label: m.label });
			}
			for (const [key, value] of Object.entries(m.values)) {
				if (value) {
					await api.patch<void>(`/api/payment-methods/${created.id}`, {
						valueKey: key,
						valueValue: value
					});
				}
			}
		}

		// 3. Clients — create blank, PATCH fields, add entries, set remapped links.
		const clientIdMap = new Map<string, string>();
		for (const c of guestSession?.clients ?? []) {
			const created = await api.post<Client>("/api/clients", { templateId: null });
			clientIdMap.set(c.id, created.id);
			await api.patch<void>(`/api/clients/${created.id}`, {
				name: c.name,
				invoicePrefix: c.invoicePrefix,
				phone: c.phone,
				email: c.email,
				address: c.address,
				serviceDescription: c.service.description,
				serviceAmount: c.service.amount,
				serviceCurrency: c.service.currency,
				year: c.year,
				isActive: c.isActive,
				expanded: guestSession?.expandedClients[c.id] ?? true
			});
			for (const e of c.invoices) {
				const entry = await api.post<InvoiceEntry>(`/api/clients/${created.id}/entries`, {
					month: e.month
				});
				await api.patch<void>(`/api/clients/${created.id}/entries/${entry.id}`, {
					issueDay: e.issueDay,
					dueDay: e.dueDay,
					isActive: e.isActive
				});
			}
			const mappedMethodIds = c.payment.methodIds
				.map((id) => methodIdMap.get(id))
				.filter((id): id is string => Boolean(id));
			if (mappedMethodIds.length > 0) {
				await api.put<void>(`/api/clients/${created.id}/payment-methods`, {
					methodIds: mappedMethodIds
				});
			}
		}

		// 4. Selected client (remapped).
		if (guestSession?.selectedClientId) {
			const mapped = clientIdMap.get(guestSession.selectedClientId);
			if (mapped) await api.put<void>("/api/fixed", { selectedClientId: mapped });
		}

		clearLocal(GUEST_FIXED_KEY);
		clearLocal(GUEST_SESSION_KEY);
		return true;
	} catch (err) {
		console.error("[migrate] invoice-generator", err);
		return false; // keep guest data so the next load can retry
	}
};
