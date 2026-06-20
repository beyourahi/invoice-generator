/**
 * qwen3 document-embedding wrapper over the owner's Workers AI binding, used by the
 * ONE-TIME seed endpoint (/api/ai/seed) to index KNOWLEDGE_CORPUS into VECTORIZE
 * (owner-paid, build-time). The per-QUERY embedding now runs on the USER's account
 * via $lib/server/ai/run-rest.runEmbeddingViaRest — see ./rag.ts.
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
