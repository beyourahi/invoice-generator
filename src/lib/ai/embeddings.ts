/**
 * qwen3 text-embedding wrappers over the Workers AI binding, used by RAG
 * (query embedding) and the seed endpoint (document embedding).
 * @see ./rag.ts — consumes embedQuery to search VECTORIZE.
 * INVARIANT: vector dimensionality (EMBEDDING_DIMS) must match the VECTORIZE index config.
 */

export const EMBEDDING_MODEL = "@cf/qwen/qwen3-embedding-0.6b" as const;
export const EMBEDDING_DIMS = 1024;

export interface EmbeddingEnv {
	AI: Ai;
}

interface EmbeddingOutput {
	data?: number[][];
	shape?: number[];
}

/**
 * Embeds a batch of corpus passages for indexing (no instruction prefix).
 * @throws if the model returns fewer/more vectors than inputs (shape mismatch guard).
 */
export const embedDocuments = async (env: EmbeddingEnv, texts: string[]): Promise<number[][]> => {
	if (texts.length === 0) return [];
	const res = (await env.AI.run(EMBEDDING_MODEL, { text: texts })) as EmbeddingOutput;
	if (!res.data || res.data.length !== texts.length) {
		throw new Error("qwen3 document embedding returned an unexpected shape");
	}
	return res.data;
};

/**
 * Embeds a single search query. qwen3 expects an `instruction` prefix on the
 * query side (asymmetric retrieval) — document embeddings must NOT pass one.
 * @throws if the model returns no vector.
 */
export const embedQuery = async (
	env: EmbeddingEnv,
	text: string,
	instruction: string
): Promise<number[]> => {
	const res = (await env.AI.run(EMBEDDING_MODEL, { text: [text], instruction })) as EmbeddingOutput;
	const vector = res.data?.[0];
	if (!vector) {
		throw new Error("qwen3 query embedding returned no vector");
	}
	return vector;
};
