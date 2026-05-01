import type { Database } from "../db";
import { listClientsByUser } from "./clients";
import { listMethodsByUser } from "./payment-methods";
import { getFixedSettings } from "./fixed";
import { toFixed, type AppState } from "../dto";

export const loadAppState = async (db: Database, userId: string): Promise<AppState> => {
	const [methods, fixedRow, clientListing] = await Promise.all([
		listMethodsByUser(db, userId),
		getFixedSettings(db, userId),
		listClientsByUser(db, userId)
	]);

	return {
		fixed: toFixed(fixedRow, methods),
		clients: clientListing.clients,
		selectedClientId: fixedRow?.selectedClientId ?? null,
		expandedClients: clientListing.expanded
	};
};
