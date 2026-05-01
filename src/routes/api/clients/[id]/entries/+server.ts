import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";
import { ok, requireApiContext } from "$lib/server/api";
import { addInvoiceEntry } from "$lib/server/repositories/clients";

export const POST: RequestHandler = async (event) => {
	const ctx = requireApiContext(event);
	const id = event.params.id;
	if (!id) throw error(400, "Missing client id");
	const entry = await addInvoiceEntry(ctx.db, ctx.userId, id);
	if (!entry) throw error(404, "Client not found");
	return ok(entry);
};
