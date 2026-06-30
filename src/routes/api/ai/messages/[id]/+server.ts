import { error } from "@sveltejs/kit";
import { z } from "zod";
import type { RequestHandler } from "./$types";
import { requireApiContext, ok } from "$lib/server/api";
import { getConversation } from "$lib/server/repositories/ai-conversations";
import { getMessage, updateMessageToolResults } from "$lib/server/repositories/ai-messages";

const bodySchema = z.object({
	toolResults: z.array(
		z.object({
			id: z.string(),
			status: z.enum(["applied", "rejected", "failed", "pending_confirmation"]),
			error: z.string().optional(),
			actionId: z.string().optional()
		})
	)
});

// PATCH /api/ai/messages/[id] — persists tool-call outcomes for an assistant
// message so a reloaded conversation shows real applied/rejected/failed status
// instead of a guess. Ownership: the message's conversation must be the caller's.
export const PATCH: RequestHandler = async (event) => {
	const { db, userId } = requireApiContext(event);
	const messageId = event.params.id;
	if (!messageId) throw error(400, "Missing message id");

	const message = await getMessage(db, messageId);
	if (!message) throw error(404, "Message not found");
	const conversation = await getConversation(db, userId, message.conversationId);
	if (!conversation) throw error(404, "Message not found");

	let body: z.infer<typeof bodySchema>;
	try {
		body = bodySchema.parse(await event.request.json());
	} catch (err) {
		throw error(400, err instanceof Error ? err.message : "Invalid request body");
	}

	await updateMessageToolResults(db, messageId, body.toolResults);
	return ok();
};
