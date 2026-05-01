import type { RequestHandler } from "./$types";
import { ok, parseJson, requireApiContext } from "$lib/server/api";
import { createClientSchema } from "$lib/server/validation";
import { createClient } from "$lib/server/repositories/clients";

export const POST: RequestHandler = async (event) => {
	const ctx = requireApiContext(event);
	const body = await parseJson(event, createClientSchema);
	const client = await createClient(ctx.db, ctx.userId, body.templateId ?? null);
	return ok(client);
};
