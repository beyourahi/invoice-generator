/**
 * Server-side driver for one chat turn: builds the OpenAI Chat Completions
 * request (system + windowed history + multimodal user content), streams it
 * through the AI Gateway, and yields parsed `Frame`s while accumulating the
 * final `RawChatResult` (full text, assembled tool calls, token usage).
 * Runs on the Worker, not the browser. @see ./gateway.ts, ./streaming.ts.
 */

import type { Frame, ParsedToolCall, ToolCatalogEntry } from "./types";
import { openGatewayChat } from "./gateway";

export interface RunChatEnv {
	AI: Ai;
	AI_GATEWAY_SLUG?: string;
}

export interface RunChatParams {
	systemContext: string;
	history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
	userMessage: string;
	conversationId: string;
	tools: ToolCatalogEntry[];
	images?: string[];
	maxTokens?: number;
	cacheKey?: string;
}

export interface RawChatResult {
	text: string;
	toolCalls: ParsedToolCall[];
	inputTokens: number;
	outputTokens: number;
	servedModel?: string;
}

interface StreamToolCallDelta {
	index?: number;
	id?: string | null;
	function?: { name?: string | null; arguments?: string | null };
}

interface StreamChoiceDelta {
	content?: string | null;
	reasoning?: string | null;
	tool_calls?: StreamToolCallDelta[];
}

interface StreamChunk {
	choices?: Array<{ delta?: StreamChoiceDelta }>;
	usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}

type ContentPart =
	| { type: "text"; text: string }
	| { type: "image_url"; image_url: { url: string } };

const buildToolsPayload = (tools: ToolCatalogEntry[]) =>
	tools.map((t) => ({
		type: "function",
		function: {
			name: t.name,
			description: t.description,
			parameters: t.parameters
		}
	}));

/** Plain string when no images; otherwise a multimodal content-part array (text + image_url). */
const buildUserContent = (text: string, images?: string[]): string | ContentPart[] => {
	if (!images || images.length === 0) return text;
	return [
		{ type: "text", text },
		...images.map((url): ContentPart => ({ type: "image_url", image_url: { url } }))
	];
};

/**
 * Yields `text`/`tool_call`/`error` frames during the turn and RETURNS the
 * accumulated RawChatResult as the generator's return value (consume via the
 * for-await done value, not a yielded frame).
 *
 * Streaming protocol notes:
 * - Defaults: temperature 0.2, max_tokens 1536, thinking disabled, usage included.
 * - `tools` are only attached when non-empty (omitting them changes model behavior).
 * - Tool-call deltas arrive fragmented across chunks; `toolAccum` reassembles by
 *   `index`, concatenating `arguments` text. Tool-call frames are emitted only
 *   AFTER the stream closes (args must be complete before JSON.parse).
 * - Malformed argument JSON degrades to `{}` rather than throwing.
 * - Gateway-open failure and mid-stream read failure both surface as a single
 *   `error` frame, then the partial result is returned.
 */
export const runChatFrames = async function* (
	env: RunChatEnv,
	params: RunChatParams
): AsyncGenerator<Frame, RawChatResult> {
	const messages = [
		{ role: "system", content: params.systemContext },
		...params.history.map((m) => ({ role: m.role, content: m.content })),
		{ role: "user", content: buildUserContent(params.userMessage, params.images) }
	];

	const input: Record<string, unknown> = {
		messages,
		max_tokens: params.maxTokens ?? 1536,
		temperature: 0.2,
		chat_template_kwargs: { thinking: false },
		stream: true,
		stream_options: { include_usage: true }
	};
	if (params.tools.length > 0) {
		input.tools = buildToolsPayload(params.tools);
	}

	const result: RawChatResult = { text: "", toolCalls: [], inputTokens: 0, outputTokens: 0 };
	const toolAccum = new Map<number, { id: string; name: string; argsText: string }>();

	let stream: ReadableStream<Uint8Array>;
	try {
		const gatewayResult = await openGatewayChat(env, input, {
			conversationId: params.conversationId,
			cacheKey: params.cacheKey
		});
		stream = gatewayResult.stream;
		if (gatewayResult.servedModel) {
			result.servedModel = gatewayResult.servedModel;
		}
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
				const delta = chunk.choices?.[0]?.delta;
				if (delta) {
					if (typeof delta.content === "string" && delta.content.length > 0) {
						result.text += delta.content;
						yield { t: "text", delta: delta.content };
					}
					if (Array.isArray(delta.tool_calls)) {
						for (const tc of delta.tool_calls) {
							const idx = typeof tc.index === "number" ? tc.index : 0;
							let entry = toolAccum.get(idx);
							if (!entry) {
								entry = {
									id: tc.id && tc.id.length > 0 ? tc.id : crypto.randomUUID(),
									name: "",
									argsText: ""
								};
								toolAccum.set(idx, entry);
							} else if (tc.id && tc.id.length > 0) {
								entry.id = tc.id;
							}
							const fn = tc.function;
							if (fn) {
								if (typeof fn.name === "string" && fn.name.length > 0) entry.name = fn.name;
								if (typeof fn.arguments === "string") entry.argsText += fn.arguments;
							}
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
