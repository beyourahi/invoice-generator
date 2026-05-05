import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";
import { ok, requireApiContext } from "$lib/server/api";
import { addInvoiceEntry } from "$lib/server/repositories/clients";
import { createEntrySchema } from "$lib/server/validation";

export const POST: RequestHandler = async (event) => {
	const ctx = requireApiContext(event);
	const id = event.params.id;
	if (!id) throw error(400, "Missing client id");

	let month = undefined;
	const body = await event.request.json().catch(() => null);
	if (body) {
		const parsed = createEntrySchema.safeParse(body);
		if (!parsed.success) throw error(400, "Invalid body");
		month = parsed.data.month;
	}

	const entry = await addInvoiceEntry(ctx.db, ctx.userId, id, month);
	if (!entry) throw error(404, "Client not found");
	return ok(entry);
};
