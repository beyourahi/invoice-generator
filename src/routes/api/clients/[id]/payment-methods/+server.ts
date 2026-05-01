import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";
import { ok, parseJson, requireApiContext } from "$lib/server/api";
import { setClientMethodsSchema } from "$lib/server/validation";
import { setClientPaymentMethods } from "$lib/server/repositories/clients";

export const PUT: RequestHandler = async (event) => {
	const ctx = requireApiContext(event);
	const id = event.params.id;
	if (!id) throw error(400, "Missing client id");
	const body = await parseJson(event, setClientMethodsSchema);
	const updated = await setClientPaymentMethods(ctx.db, ctx.userId, id, body.methodIds);
	if (!updated) throw error(404, "Client not found");
	return ok();
};
