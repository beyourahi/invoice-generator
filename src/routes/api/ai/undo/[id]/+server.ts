import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireApiContext, ok } from "$lib/server/api";
import { getActionById, markUndone, markUndoFailed } from "$lib/server/repositories/ai-actions";
import { applyInverse, UndoInvalidatedError } from "$lib/server/ai-undo";

export const POST: RequestHandler = async (event) => {
	const { db, userId } = requireApiContext(event);
	const id = event.params.id;
	if (!id) throw error(400, "Missing id");

	const action = await getActionById(db, userId, id);
	if (!action) throw error(404, "Action not found");
	if (action.status !== "applied") {
		throw error(409, `Cannot undo action with status ${action.status}`);
	}

	try {
		await applyInverse(db, userId, action.inverse);
		await markUndone(db, userId, id);
		return ok({ id, status: "undone" });
	} catch (err) {
		const message =
			err instanceof UndoInvalidatedError
				? err.message
				: err instanceof Error
					? err.message
					: "Undo failed";
		await markUndoFailed(db, userId, id, message);
		throw error(409, message);
	}
};
