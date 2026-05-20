import type { Frame, ParsedToolCall, ToolCatalogEntry } from "./types";

export const MODEL_ID = "@cf/meta/llama-4-scout-17b-16e-instruct" as const;

export interface RunChatEnv {
	AI: Ai;
	AI_GATEWAY_SLUG?: string;
}

export interface RunChatParams {
	systemContext: string;
	history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
	userMessage: string;
	tools: ToolCatalogEntry[];
	maxTokens?: number;
	cacheKey?: string;
}

export interface RawChatResult {
	text: string;
	toolCalls: ParsedToolCall[];
	inputTokens: number;
	outputTokens: number;
}

interface StreamChunk {
	response?: string;
	tool_calls?: Array<{ name?: string; arguments?: unknown; args?: unknown }>;
	usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const buildToolsPayload = (tools: ToolCatalogEntry[]) =>
	tools.map((t) => ({
		name: t.name,
		description: t.description,
		parameters: t.parameters
	}));

const normalizeToolCall = (raw: {
	name?: string;
	arguments?: unknown;
	args?: unknown;
}): ParsedToolCall | null => {
	const name = typeof raw.name === "string" ? raw.name : null;
	if (!name) return null;
	const argsField = raw.arguments ?? raw.args;
	let parsed: unknown = argsField;
	if (typeof argsField === "string") {
		try {
			parsed = JSON.parse(argsField);
		} catch {
			parsed = {};
		}
	}
	return { id: crypto.randomUUID(), name, args: parsed ?? {} };
};

const buildGatewayOptions = (env: RunChatEnv, cacheKey?: string) => {
	if (!env.AI_GATEWAY_SLUG || env.AI_GATEWAY_SLUG.length === 0) return undefined;
	const gateway = cacheKey
		? { id: env.AI_GATEWAY_SLUG, skipCache: false, cacheKey }
		: { id: env.AI_GATEWAY_SLUG, skipCache: true };
	return { gateway };
};

export const runChatFrames = async function* (
	env: RunChatEnv,
	params: RunChatParams
): AsyncGenerator<Frame, RawChatResult> {
	const messages = [
		{ role: "system", content: params.systemContext },
		...params.history.map((m) => ({ role: m.role, content: m.content })),
		{ role: "user", content: params.userMessage }
	];

	const input: Record<string, unknown> = {
		messages,
		max_tokens: params.maxTokens ?? 800,
		temperature: 0.2,
		stream: true
	};
	if (params.tools.length > 0) {
		input.tools = buildToolsPayload(params.tools);
	}

	const result: RawChatResult = { text: "", toolCalls: [], inputTokens: 0, outputTokens: 0 };

	let stream: ReadableStream<Uint8Array>;
	try {
		stream = (await env.AI.run(
			MODEL_ID,
			input,
			buildGatewayOptions(env, params.cacheKey)
		)) as unknown as ReadableStream<Uint8Array>;
	} catch (err) {
		yield {
			t: "error",
			message: err instanceof Error ? err.message : "Model invocation failed"
		};
		return result;
	}

	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			let newlineIdx = buffer.indexOf("\n");
			while (newlineIdx !== -1) {
				const line = buffer.slice(0, newlineIdx).trim();
				buffer = buffer.slice(newlineIdx + 1);
				newlineIdx = buffer.indexOf("\n");
				if (!line.startsWith("data:")) continue;
				const payload = line.slice(5).trim();
				if (payload.length === 0 || payload === "[DONE]") continue;
				let chunk: StreamChunk;
				try {
					chunk = JSON.parse(payload) as StreamChunk;
				} catch {
					continue;
				}
				if (typeof chunk.response === "string" && chunk.response.length > 0) {
					result.text += chunk.response;
					yield { t: "text", delta: chunk.response };
				}
				if (Array.isArray(chunk.tool_calls)) {
					for (const raw of chunk.tool_calls) {
						const call = normalizeToolCall(raw);
						if (call) result.toolCalls.push(call);
					}
				}
				if (chunk.usage) {
					result.inputTokens = chunk.usage.prompt_tokens ?? result.inputTokens;
					result.outputTokens = chunk.usage.completion_tokens ?? result.outputTokens;
				}
			}
		}
	} catch (err) {
		yield {
			t: "error",
			message: err instanceof Error ? err.message : "Stream read failed"
		};
		return result;
	} finally {
		reader.releaseLock();
	}

	for (const call of result.toolCalls) {
		yield { t: "tool_call", id: call.id, name: call.name, args: call.args };
	}

	return result;
};
