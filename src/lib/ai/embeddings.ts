export const EMBEDDING_MODEL = "@cf/qwen/qwen3-embedding-0.6b" as const;
export const EMBEDDING_DIMS = 1024;

export interface EmbeddingEnv {
	AI: Ai;
}

interface EmbeddingOutput {
	data?: number[][];
	shape?: number[];
}

export const embedDocuments = async (env: EmbeddingEnv, texts: string[]): Promise<number[][]> => {
	if (texts.length === 0) return [];
	const res = (await env.AI.run(EMBEDDING_MODEL, { text: texts })) as EmbeddingOutput;
	if (!res.data || res.data.length !== texts.length) {
		throw new Error("qwen3 document embedding returned an unexpected shape");
	}
	return res.data;
};

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
