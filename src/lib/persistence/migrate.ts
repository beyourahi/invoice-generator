/**
 * One-time import of a guest's localStorage snapshot into their account on first
 * sign-in. Sends the whole snapshot to POST /api/import, which writes sender,
 * payment methods, clients, entries, and links in ONE atomic D1 batch (server-side
 * id remapping included).
 *
 * Runs only when the account is empty (fresh user), so it never merges into or
 * clobbers existing account data; a populated account simply keeps its own data
 * and the guest snapshot is left untouched (the server also re-checks and 409s).
 * On success the guest keys are cleared and the caller reloads so the server load
 * re-hydrates the stores from D1. Because the import is atomic, any failure commits
 * NOTHING — the account stays empty — so the guest data is retained and the next
 * load retries cleanly without duplicating rows.
 */
import { api } from "$lib/api/client";
import type { Fixed } from "$lib/types";
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
		await api.post<{ imported: boolean }>("/api/import", {
			fixed: guestFixed,
			session: guestSession
		});
		clearLocal(GUEST_FIXED_KEY);
		clearLocal(GUEST_SESSION_KEY);
		return true;
	} catch (err) {
		// Atomic import committed nothing on failure; keep guest data to retry.
		console.error("[migrate] invoice-generator", err);
		return false;
	}
};
