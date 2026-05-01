import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";
import { ok, parseJson, requireApiContext } from "$lib/server/api";
import { updateEntrySchema } from "$lib/server/validation";
import { deleteInvoiceEntry, updateInvoiceEntry } from "$lib/server/repositories/clients";

export const PATCH: RequestHandler = async (event) => {
	const ctx = requireApiContext(event);
	const clientId = event.params.id;
	const entryId = event.params.entryId;
	if (!clientId || !entryId) throw error(400, "Missing id");
	const body = await parseJson(event, updateEntrySchema);
	const updated = await updateInvoiceEntry(ctx.db, ctx.userId, clientId, entryId, body);
	if (!updated) throw error(404, "Entry not found");
	return ok();
};

export const DELETE: RequestHandler = async (event) => {
	const ctx = requireApiContext(event);
	const clientId = event.params.id;
	const entryId = event.params.entryId;
	if (!clientId || !entryId) throw error(400, "Missing id");
	const removed = await deleteInvoiceEntry(ctx.db, ctx.userId, clientId, entryId);
	if (!removed) throw error(404, "Entry not found");
	return ok();
};
