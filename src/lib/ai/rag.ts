/**
 * Retrieval step for the Copilot: turns the user message into app-help context
 * pulled from the VECTORIZE index, formatted for injection into the user turn.
 *
 * The per-QUERY embedding runs on the USER's own Cloudflare account via the Workers
 * AI REST API (BYO — billed to the user), NOT the owner's bound `env.AI`. The
 * VECTORIZE index itself is the owner's, seeded once at build time (see /api/ai/seed,
 * which still uses `env.AI`). INVARIANT: returns nothing until the index is seeded;
 * the chat turn degrades silently to no APP KNOWLEDGE if the index is empty/unbound.
 * @see ./knowledge.ts (corpus), ./prompts.ts buildUserTurn (consumes formatKnowledge output).
 */

import { runEmbeddingViaRest, type CloudflareCreds } from "$lib/server/ai/run-rest";

export interface RagEnv {
	VECTORIZE: VectorizeIndex;
}

export interface RagChunk {
	id: string;
	text: string;
	score: number;
}

const QUERY_INSTRUCTION =
	"Given a question about using the invoice generator app, retrieve the most relevant help passages.";

const MIN_SCORE = 0.4;

/**
 * Embeds `query` on the user's account, runs a topK similarity search against the
 * owner's VECTORIZE index, drops matches below MIN_SCORE and any with empty metadata
 * text. Returns [] for blank queries.
 * @throws propagates the embedding failure; VECTORIZE.query errors bubble to caller
 *   (the chat endpoint catches both so RAG fails open).
 */
export const retrieveAppKnowledge = async (
	env: RagEnv,
	creds: CloudflareCreds,
	query: string,
	topK = 4
): Promise<RagChunk[]> => {
	const trimmed = query.trim();
	if (trimmed.length === 0) return [];
	const vector = await runEmbeddingViaRest(creds, trimmed, QUERY_INSTRUCTION);
	const result = await env.VECTORIZE.query(vector, { topK, returnMetadata: "all" });
	return (result.matches ?? [])
		.filter((m) => typeof m.score === "number" && m.score >= MIN_SCORE)
		.map((m) => ({
			id: m.id,
			text: typeof m.metadata?.text === "string" ? m.metadata.text : "",
			score: m.score
		}))
		.filter((c) => c.text.length > 0);
};

export const formatKnowledge = (chunks: RagChunk[]): string => {
	if (chunks.length === 0) return "";
	return chunks.map((chunk, index) => `[${index + 1}] ${chunk.text}`).join("\n");
};
