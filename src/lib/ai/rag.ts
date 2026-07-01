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
	/** Owner's Workers AI binding — the SAME one the seed route uses; drives the reranker. */
	AI: Ai;
}

export interface RagChunk {
	id: string;
	text: string;
	score: number;
}

const QUERY_INSTRUCTION =
	"Given a question about using the invoice generator app, retrieve the most relevant help passages.";

/** Reranker run on the owner's env.AI binding. Contract: { query, contexts:[{text}], top_k? } → { response:[{id,score}] } (id = index into contexts). */
const RERANKER_MODEL = "@cf/baai/bge-reranker-base" as const;

/** Widen the Vectorize pool, rerank, then narrow to this many chunks for the LLM. */
const CANDIDATE_K = 12;
const FINAL_K = 4;

/**
 * Pre-rerank floor on qwen3 COSINE similarity — drops obvious junk before the reranker
 * sees it, so a no-match query never wastes a rerank on garbage. Deliberately loose
 * (the reranker does the real precision work below).
 */
const MIN_COSINE = 0.3;
/**
 * Post-rerank floor on the SIGMOID-mapped bge logit (0..1). bge-reranker-base emits
 * logits; 0.5 is the net-relevant midpoint. ponytail: single tuning knob — raise for
 * precision, lower for recall; no per-query calibration.
 */
const MIN_RERANK_SCORE = 0.5;
/** bge-reranker-base caps each context at 512 tokens (~2000 chars). Truncate for the rerank call ONLY — the full chunk text still reaches the LLM. */
const RERANK_CHAR_LIMIT = 2000;

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

/**
 * Embeds `query` on the user's account, runs a wide topK similarity search against the
 * owner's VECTORIZE index, drops matches below MIN_COSINE and any with empty metadata
 * text, then reranks the pool with bge-reranker-base and keeps the top FINAL_K in rerank
 * order. Returns [] for blank queries.
 * @throws propagates the embedding failure; VECTORIZE.query errors bubble to caller
 *   (the chat endpoint catches both so RAG fails open). Reranker errors fail open
 *   INTERNALLY to the pre-rerank cosine order — they never break retrieval.
 */
export const retrieveAppKnowledge = async (
	env: RagEnv,
	creds: CloudflareCreds,
	query: string,
	topK = CANDIDATE_K
): Promise<RagChunk[]> => {
	const trimmed = query.trim();
	if (trimmed.length === 0) return [];
	const vector = await runEmbeddingViaRest(creds, trimmed, QUERY_INSTRUCTION);
	const result = await env.VECTORIZE.query(vector, { topK, returnMetadata: "all" });

	// Candidate pool keeps the FULL chunk text (only the reranker's contexts are truncated below).
	const candidates: RagChunk[] = (result.matches ?? [])
		.filter((m) => typeof m.score === "number" && m.score >= MIN_COSINE)
		.map((m) => ({
			id: m.id,
			text: typeof m.metadata?.text === "string" ? m.metadata.text : "",
			score: m.score
		}))
		.filter((c) => c.text.length > 0);
	if (candidates.length === 0) return [];

	return rerankCandidates(env, trimmed, candidates);
};

/**
 * Reorders the cosine-filtered pool with bge-reranker-base on the owner's env.AI,
 * attaching the sigmoid-mapped score and keeping up to FINAL_K above MIN_RERANK_SCORE.
 * The reranker's `id` is the INDEX into the contexts array we pass, so each result is
 * resolved back through the parallel `candidates` array. Fails open: any reranker error
 * (or an empty response) → the pre-rerank cosine order, capped at FINAL_K.
 */
const rerankCandidates = async (
	env: RagEnv,
	query: string,
	candidates: RagChunk[]
): Promise<RagChunk[]> => {
	try {
		// Bound to a variable (not an inline literal) so the extra `query` field is
		// allowed past the generated input type, which omits it.
		const rerankInput = {
			query,
			contexts: candidates.map((c) => ({ text: c.text.slice(0, RERANK_CHAR_LIMIT) })),
			top_k: candidates.length
		};
		const res = await env.AI.run(RERANKER_MODEL, rerankInput);
		const response = res.response ?? [];
		if (response.length === 0) return candidates.slice(0, FINAL_K);

		return response
			.flatMap((r) => {
				if (typeof r.id !== "number" || typeof r.score !== "number") return [];
				const match = candidates[r.id];
				return match ? [{ ...match, score: sigmoid(r.score) }] : [];
			})
			.filter((c) => c.score >= MIN_RERANK_SCORE)
			.slice(0, FINAL_K);
	} catch {
		return candidates.slice(0, FINAL_K);
	}
};

export const formatKnowledge = (chunks: RagChunk[]): string => {
	if (chunks.length === 0) return "";
	return chunks.map((chunk, index) => `[${index + 1}] ${chunk.text}`).join("\n");
};
