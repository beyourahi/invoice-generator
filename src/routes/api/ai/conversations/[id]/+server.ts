import { error } from "@sveltejs/kit";
import { z } from "zod";
import type { RequestHandler } from "./$types";
import { requireApiContext, parseJson, ok } from "$lib/server/api";
import {
	deleteConversation,
	renameConversation
} from "$lib/server/repositories/ai-conversations";

const renameSchema = z.object({
	title: z.string().min(1).max(120)
});

export const PATCH: RequestHandler = async (event) => {
	const { db, userId } = requireApiContext(event);
	const id = event.params.id;
	if (!id) throw error(400, "Missing id");
	const { title } = await parseJson(event, renameSchema);
	const success = await renameConversation(db, userId, id, title);
	if (!success) throw error(404, "Conversation not found");
	return ok();
};

export const DELETE: RequestHandler = async (event) => {
	const { db, userId } = requireApiContext(event);
	const id = event.params.id;
	if (!id) throw error(400, "Missing id");
	await deleteConversation(db, userId, id);
	return ok();
};
