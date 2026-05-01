import type { RequestHandler } from "./$types";
import { ok, parseJson, requireApiContext } from "$lib/server/api";
import { fromPatchSchema, setSelectedSchema } from "$lib/server/validation";
import { setSelectedClientId, upsertFrom } from "$lib/server/repositories/fixed";

export const PATCH: RequestHandler = async (event) => {
	const ctx = requireApiContext(event);
	const patch = await parseJson(event, fromPatchSchema);
	await upsertFrom(ctx.db, ctx.userId, patch);
	return ok();
};

export const PUT: RequestHandler = async (event) => {
	const ctx = requireApiContext(event);
	const body = await parseJson(event, setSelectedSchema);
	await setSelectedClientId(ctx.db, ctx.userId, body.selectedClientId);
	return ok();
};
