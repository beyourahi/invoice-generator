/**
 * Single entry point for invoking the chat model through the AI Gateway.
 * The call targets a Gateway *dynamic route* (not a specific model), so the
 * actual model fallback order lives in the Gateway dashboard, not here.
 * @see ./client.ts (sole caller, streams the result).
 */

export const DYNAMIC_ROUTE = "dynamic/copilot-chain" as const;

/**
 * Documents the fallback chain configured in the AI Gateway dashboard for
 * DYNAMIC_ROUTE — it does NOT set it. Editing this array changes nothing at
 * runtime; reorder/replace models in the dashboard. The chain requires
 * tool-calling + vision support across every model.
 */
export const MODEL_CHAIN = [
	"@cf/moonshotai/kimi-k2.6",
	"@cf/google/gemma-4-26b-a4b-it",
	"@cf/meta/llama-4-scout-17b-16e-instruct"
] as const;

export const FIRST_TOKEN_TIMEOUT_MS = 8000;

export interface GatewayEnv {
	AI: Ai;
	AI_GATEWAY_SLUG?: string;
}

export interface GatewayChatOptions {
	conversationId?: string;
	cacheKey?: string;
}

export interface GatewayChatResult {
	stream: ReadableStream<Uint8Array>;
	servedModel: string | null;
	servedProvider: string | null;
}

type AiRun = (
	model: string,
	input: Record<string, unknown>,
	opts?: { gateway?: { id: string; skipCache?: boolean; cacheKey?: string } }
) => Promise<unknown>;

/**
 * Runs the dynamic route and returns the raw SSE byte stream.
 * Caching: a `cacheKey` opts the turn INTO the Gateway cache; absence forces
 * `skipCache: true` (state-mutating turns must not be cached). `servedModel`/
 * `servedProvider` are always null here (not surfaced by the dynamic-route response).
 * @throws if AI_GATEWAY_SLUG is unset — the feature cannot run without it.
 */
export const openGatewayChat = async (
	env: GatewayEnv,
	input: Record<string, unknown>,
	options?: GatewayChatOptions
): Promise<GatewayChatResult> => {
	const slug = env.AI_GATEWAY_SLUG;
	if (!slug || slug.length === 0) {
		throw new Error("AI_GATEWAY_SLUG is not configured");
	}
	const gateway = options?.cacheKey
		? { id: slug, skipCache: false, cacheKey: options.cacheKey }
		: { id: slug, skipCache: true };
	const ai = env.AI as unknown as { run: AiRun };
	const stream = (await ai.run(DYNAMIC_ROUTE, input, { gateway })) as ReadableStream<Uint8Array>;
	return { stream, servedModel: null, servedProvider: null };
};
