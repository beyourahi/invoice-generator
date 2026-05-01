import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";
import { ok, parseJson, requireApiContext } from "$lib/server/api";
import { updateMethodSchema } from "$lib/server/validation";
import {
	deletePaymentMethod,
	purgeMethodFromAllClients,
	updatePaymentMethod
} from "$lib/server/repositories/payment-methods";

export const PATCH: RequestHandler = async (event) => {
	const ctx = requireApiContext(event);
	const body = await parseJson(event, updateMethodSchema);
	const id = event.params.id;
	if (!id) throw error(400, "Missing id");

	const patch =
		body.valueKey !== undefined && body.valueValue !== undefined
			? { label: body.label, value: { key: body.valueKey, value: body.valueValue } }
			: { label: body.label };

	const updated = await updatePaymentMethod(ctx.db, ctx.userId, id, patch);
	if (!updated) throw error(404, "Payment method not found");
	return ok();
};

export const DELETE: RequestHandler = async (event) => {
	const ctx = requireApiContext(event);
	const id = event.params.id;
	if (!id) throw error(400, "Missing id");
	await purgeMethodFromAllClients(ctx.db, ctx.userId, id);
	await deletePaymentMethod(ctx.db, ctx.userId, id);
	return ok();
};
