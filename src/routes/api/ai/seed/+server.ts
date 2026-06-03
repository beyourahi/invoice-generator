import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { KNOWLEDGE_CORPUS } from "$lib/ai/knowledge";
import { embedDocuments } from "$lib/ai/embeddings";

/**
 * POST /api/ai/seed — embeds KNOWLEDGE_CORPUS via qwen3 and upserts it into the
 * VECTORIZE RAG index. Idempotent (upsert by chunk id). Re-run whenever the corpus changes.
 *
 * AUTH: NOT requireApiContext. Guarded solely by the `x-seed-secret` header
 * matching env.SEED_SECRET → 401 otherwise. 503 if AI or VECTORIZE binding absent.
 * @returns { seeded: <record count> }
 */
export const POST: RequestHandler = async (event) => {
	const env = event.platform?.env;
	if (!env?.AI || !env.VECTORIZE) {
		throw error(503, "AI or Vectorize binding unavailable");
	}
	const secret = env.SEED_SECRET;
	if (!secret || event.request.headers.get("x-seed-secret") !== secret) {
		throw error(401, "Unauthorized");
	}

	const texts = KNOWLEDGE_CORPUS.map((chunk) => chunk.text);
	const vectors = await embedDocuments(env, texts);
	const records = KNOWLEDGE_CORPUS.map((chunk, index) => ({
		id: chunk.id,
		values: vectors[index],
		metadata: { text: chunk.text }
	}));
	await env.VECTORIZE.upsert(records);

	return json({ seeded: records.length });
};
