/**
 * Versioned localStorage keys for the logged-out (guest) snapshot, split to match
 * the two stores that own them. Kept in one place so the stores and the sign-in
 * import (`migrate.ts`) reference the exact same strings without a circular import
 * (this module imports nothing).
 */
export const GUEST_FIXED_KEY = "invoice-generator:guest:fixed:v1";
export const GUEST_SESSION_KEY = "invoice-generator:guest:session:v1";

/** Shape mirrored by the session store under GUEST_SESSION_KEY. */
export interface GuestSessionSnapshot {
	clients: import("$lib/types").Client[];
	selectedClientId: string | null;
	expandedClients: Record<string, boolean>;
}
