import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { z } from "zod";
import { getDatabase, type Database } from "./db";

export interface ApiContext {
	db: Database;
	userId: string;
}

export const requireApiContext = (event: RequestEvent): ApiContext => {
	const userId = event.locals.user?.id;
	if (!userId) {
		throw error(401, "Unauthorized");
	}

	const d1 = event.platform?.env?.DB;
	if (!d1) {
		throw error(503, "Database unavailable");
	}

	return { db: getDatabase(d1), userId };
};

export const parseJson = async <T extends z.ZodTypeAny>(
	event: RequestEvent,
	schema: T
): Promise<z.infer<T>> => {
	let raw: unknown;
	try {
		raw = await event.request.json();
	} catch {
		throw error(400, "Invalid JSON body");
	}
	const result = schema.safeParse(raw);
	if (!result.success) {
		throw error(400, result.error.issues[0]?.message ?? "Invalid request body");
	}
	return result.data;
};

export const ok = <T>(data?: T) =>
	data === undefined ? new Response(null, { status: 204 }) : json(data);
