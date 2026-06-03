import type { RequestHandler } from "./$types";
import { ok, parseJson, requireApiContext } from "$lib/server/api";
import { createClientSchema } from "$lib/server/validation";
import { createClient } from "$lib/server/repositories/clients";

// POST /api/clients — creates a client. Optional body.templateId deep-copies an
// existing client's fields/payment-methods as a starting point. Auth + D1 via requireApiContext.
export const POST: RequestHandler = async (event) => {
	const ctx = requireApiContext(event);
	const body = await parseJson(event, createClientSchema);
	const client = await createClient(ctx.db, ctx.userId, body.templateId ?? null);
	return ok(client);
};
