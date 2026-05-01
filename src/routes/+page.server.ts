import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { getDatabase } from "$lib/server/db";
import { loadAppState } from "$lib/server/repositories/state";
import type { AppState } from "$lib/server/dto";

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.user) {
		redirect(303, "/login");
	}

	const d1 = platform?.env?.DB;
	let appState: AppState = {
		fixed: { from: { name: "", phone: "", email: "", address: "" }, paymentMethods: [] },
		clients: [],
		selectedClientId: null,
		expandedClients: {}
	};

	if (d1) {
		const db = getDatabase(d1);
		appState = await loadAppState(db, locals.user.id);
	}

	return {
		user: locals.user,
		currentUser: locals.currentUser,
		appState
	};
};
