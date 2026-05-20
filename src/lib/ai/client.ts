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

interface StreamToolCallDelta {
	id?: string | null;
	index?: number;
	function?: { name?: string | null; arguments?: string };
}

interface StreamChunk {
	response?: string;
	tool_calls?: StreamToolCallDelta[];
	usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const buildToolsPayload = (tools: ToolCatalogEntry[]) =>
	tools.map((t) => ({
		type: "function",
		function: {
			name: t.name,
			description: t.description,
			parameters: t.parameters
		}
	}));

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
	const toolAccum = new Map<number, { id: string; name: string; argsText: string }>();

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
					for (const delta of chunk.tool_calls) {
						const idx = typeof delta.index === "number" ? delta.index : 0;
						let entry = toolAccum.get(idx);
						if (!entry) {
							entry = { id: crypto.randomUUID(), name: "", argsText: "" };
							toolAccum.set(idx, entry);
						}
						const fn = delta.function;
						if (fn) {
							if (typeof fn.name === "string" && fn.name.length > 0) entry.name = fn.name;
							if (typeof fn.arguments === "string") entry.argsText += fn.arguments;
						}
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

	for (const entry of toolAccum.values()) {
		if (entry.name.length === 0) continue;
		let args: unknown = {};
		if (entry.argsText.trim().length > 0) {
			try {
				args = JSON.parse(entry.argsText);
			} catch {
				args = {};
			}
		}
		const call: ParsedToolCall = { id: entry.id, name: entry.name, args };
		result.toolCalls.push(call);
		yield { t: "tool_call", id: call.id, name: call.name, args: call.args };
	}

	return result;
};
