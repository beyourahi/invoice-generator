import type { Frame, ParsedToolCall, ToolCatalogEntry } from "./types";

export const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast" as const;

export interface RunChatEnv {
	AI: Ai;
	AI_GATEWAY_SLUG?: string;
	CLOUDFLARE_ACCOUNT_ID?: string;
}

export interface RunChatParams {
	systemContext: string;
	history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
	userMessage: string;
	tools: ToolCatalogEntry[];
	maxTokens?: number;
}

export interface RawChatResult {
	text: string;
	toolCalls: ParsedToolCall[];
	inputTokens: number;
	outputTokens: number;
}

interface InternalResponse {
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

const inferRaw = async (env: RunChatEnv, params: RunChatParams): Promise<RawChatResult> => {
	const messages: Array<{ role: string; content: string }> = [
		{ role: "system", content: params.systemContext },
		...params.history.map((m) => ({ role: m.role, content: m.content })),
		{ role: "user", content: params.userMessage }
	];

	const input: Record<string, unknown> = {
		messages,
		max_tokens: params.maxTokens ?? 800,
		temperature: 0.2
	};
	if (params.tools.length > 0) {
		input.tools = buildToolsPayload(params.tools);
	}

	const aiOptions: { gateway?: { id: string; skipCache?: boolean } } = {};
	if (env.AI_GATEWAY_SLUG && env.AI_GATEWAY_SLUG.length > 0) {
		aiOptions.gateway = { id: env.AI_GATEWAY_SLUG };
	}

	const raw = (await env.AI.run(MODEL_ID, input, aiOptions)) as unknown as InternalResponse;

	const text = typeof raw.response === "string" ? raw.response : "";
	const toolCalls = Array.isArray(raw.tool_calls)
		? raw.tool_calls.map((c) => normalizeToolCall(c)).filter((c): c is ParsedToolCall => c !== null)
		: [];

	return {
		text,
		toolCalls,
		inputTokens: raw.usage?.prompt_tokens ?? 0,
		outputTokens: raw.usage?.completion_tokens ?? 0
	};
};

const CHUNK_SIZE = 18;

export const runChatFrames = async function* (
	env: RunChatEnv,
	params: RunChatParams
): AsyncGenerator<Frame, RawChatResult> {
	const turnId = crypto.randomUUID();
	let result: RawChatResult;
	try {
		result = await inferRaw(env, params);
	} catch (err) {
		yield {
			t: "error",
			message: err instanceof Error ? err.message : "Model invocation failed"
		};
		return {
			text: "",
			toolCalls: [],
			inputTokens: 0,
			outputTokens: 0
		};
	}

	for (let i = 0; i < result.text.length; i += CHUNK_SIZE) {
		yield { t: "text", delta: result.text.slice(i, i + CHUNK_SIZE) };
	}

	for (const call of result.toolCalls) {
		yield { t: "tool_call", id: call.id, name: call.name, args: call.args };
	}

	yield {
		t: "end",
		turnId,
		inputTokens: result.inputTokens,
		outputTokens: result.outputTokens
	};

	return result;
};
