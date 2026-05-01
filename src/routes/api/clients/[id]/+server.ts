import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";
import { ok, parseJson, requireApiContext } from "$lib/server/api";
import { updateClientSchema } from "$lib/server/validation";
import { deleteClient, updateClient } from "$lib/server/repositories/clients";

export const PATCH: RequestHandler = async (event) => {
	const ctx = requireApiContext(event);
	const id = event.params.id;
	if (!id) throw error(400, "Missing id");
	const body = await parseJson(event, updateClientSchema);
	const ok2 = await updateClient(ctx.db, ctx.userId, id, body);
	if (!ok2) throw error(404, "Client not found");
	return ok();
};

export const DELETE: RequestHandler = async (event) => {
	const ctx = requireApiContext(event);
	const id = event.params.id;
	if (!id) throw error(400, "Missing id");
	await deleteClient(ctx.db, ctx.userId, id);
	return ok();
};
