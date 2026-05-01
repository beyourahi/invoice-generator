import type { RequestHandler } from "./$types";
import { ok, parseJson, requireApiContext } from "$lib/server/api";
import { createMethodSchema, reorderSchema } from "$lib/server/validation";
import {
	createPaymentMethod,
	reorderPaymentMethods
} from "$lib/server/repositories/payment-methods";
import type { PaymentMethodKind } from "$lib/types";

export const POST: RequestHandler = async (event) => {
	const ctx = requireApiContext(event);
	const body = await parseJson(event, createMethodSchema);
	const method = await createPaymentMethod(ctx.db, ctx.userId, body.kind as PaymentMethodKind);
	return ok(method);
};

export const PUT: RequestHandler = async (event) => {
	const ctx = requireApiContext(event);
	const body = await parseJson(event, reorderSchema);
	await reorderPaymentMethods(ctx.db, ctx.userId, body.orderedIds);
	return ok();
};
