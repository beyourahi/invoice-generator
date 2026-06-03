import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";
import { ok, requireApiContext } from "$lib/server/api";
import { addInvoiceEntry } from "$lib/server/repositories/clients";
import { createEntrySchema } from "$lib/server/validation";

// POST /api/clients/[id]/entries — adds an invoice entry to a client. Body is
// optional; when present it must validate (400) and supplies the initial month.
// 404 if the client is not owned/found. Auth + D1 via requireApiContext.
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
