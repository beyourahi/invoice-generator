/**
 * Per-user Cloudflare Workers AI over the REST API.
 *
 * Copilot chat inference, the per-query RAG embedding, and the model catalog run on
 * the END USER's own Cloudflare account (billed to them), NOT the owner's bound
 * `env.AI`. Every call authenticates with the user's account-scoped API token
 * (least-privilege: Account → Workers AI → Read).
 *
 *   runChatViaRest      → POST /accounts/{id}/ai/run/{model}                       (one buffered chat turn)
 *   runEmbeddingViaRest → POST /accounts/{id}/ai/run/@cf/qwen/qwen3-embedding-0.6b (one query embedding)
 *   listChatModels      → GET  /accounts/{id}/ai/models/search                     (chat models for the picker)
 *
 * The REST envelope wraps the model output in `{ success, result, errors }`; we
 * unwrap `result` so the inner shape matches what the `env.AI` binding returns directly.
 */

const CF_API = "https://api.cloudflare.com/client/v4";

/** Default chat model — the Copilot's recommended, validated choice. New users start here. */
export const DEFAULT_MODEL = "@cf/moonshotai/kimi-k2.6";

/** Embedding model used for the per-query RAG search (must match the VECTORIZE index dims). */
const EMBEDDING_MODEL = "@cf/qwen/qwen3-embedding-0.6b";

export interface CloudflareCreds {
	accountId: string;
	apiToken: string;
}

/** A model surfaced in the picker. `id` is the run path (e.g. "@cf/moonshotai/kimi-k2.6"). */
export interface CfModel {
	id: string;
	label: string;
	task: string;
	description: string;
	deprecated: boolean;
	beta: boolean;
}

/** Chat-completions request, mirroring the binding contract the gateway runner built. */
export interface ChatRestInput {
	messages: Array<Record<string, unknown>>;
	tools?: Array<Record<string, unknown>>;
	max_tokens?: number;
	temperature?: number;
}

/** Unwrapped chat result. Shape matches what the `env.AI` binding returns for a run. */
export interface ChatRestResult {
	response?: string;
	tool_calls?: Array<{ name?: string; arguments?: unknown }>;
	usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export type CfErrorKind = "auth" | "rate_limit" | "model_unavailable" | "transport";

/** Typed Workers AI REST failure. `kind` drives the consumer's user-facing message. */
export class CfInferenceError extends Error {
	public readonly status: number;
	public readonly kind: CfErrorKind;
	constructor(status: number, kind: CfErrorKind, message: string) {
		super(message);
		this.name = "CfInferenceError";
		this.status = status;
		this.kind = kind;
	}
}

const kindForStatus = (status: number): CfErrorKind => {
	if (status === 401 || status === 403) return "auth";
	if (status === 429) return "rate_limit";
	if (status === 404) return "model_unavailable";
	return "transport";
};

/**
 * Runs one chat turn on the user's chosen model + account. Returns the unwrapped
 * model output (`{ response?, tool_calls?, usage? }`). Throws `CfInferenceError`
 * on any non-2xx so the consumer can map it to a clean error frame.
 */
export const runChatViaRest = async (
	creds: CloudflareCreds,
	model: string,
	input: ChatRestInput
): Promise<ChatRestResult> => {
	let res: Response;
	try {
		res = await fetch(`${CF_API}/accounts/${creds.accountId}/ai/run/${model}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${creds.apiToken}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				messages: input.messages,
				...(input.tools && input.tools.length > 0 ? { tools: input.tools } : {}),
				max_tokens: input.max_tokens ?? 1536,
				temperature: input.temperature ?? 0.2
			})
		});
	} catch (e) {
		throw new CfInferenceError(0, "transport", e instanceof Error ? e.message : "network error");
	}

	if (!res.ok) {
		throw new CfInferenceError(
			res.status,
			kindForStatus(res.status),
			`Workers AI REST ${res.status}`
		);
	}

	// Native Workers AI REST wraps the output: { success, result, errors }.
	const json = (await res.json()) as { result?: ChatRestResult };
	return json && typeof json === "object" && "result" in json
		? (json.result ?? {})
		: (json as unknown as ChatRestResult);
};

/**
 * Embeds a single RAG query on the user's account (asymmetric retrieval — qwen3
 * takes an `instruction` prefix on the query side). Returns the vector.
 * @throws CfInferenceError on transport/auth failure; throws on empty result.
 */
export const runEmbeddingViaRest = async (
	creds: CloudflareCreds,
	text: string,
	instruction: string
): Promise<number[]> => {
	let res: Response;
	try {
		res = await fetch(`${CF_API}/accounts/${creds.accountId}/ai/run/${EMBEDDING_MODEL}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${creds.apiToken}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ text: [text], instruction })
		});
	} catch (e) {
		throw new CfInferenceError(0, "transport", e instanceof Error ? e.message : "network error");
	}
	if (!res.ok) {
		throw new CfInferenceError(
			res.status,
			kindForStatus(res.status),
			`Workers AI REST ${res.status}`
		);
	}
	const json = (await res.json()) as { result?: { data?: number[][] } };
	const vector = json.result?.data?.[0];
	if (!vector) {
		throw new CfInferenceError(0, "transport", "qwen3 query embedding returned no vector");
	}
	return vector;
};

// ── Model catalog ────────────────────────────────────────────────────────────

/** Raw `/ai/models/search` entry (only the fields we read; shape is defensive). */
interface RawModel {
	id?: string;
	name?: string;
	description?: string;
	task?: { name?: string } | null;
	tags?: string[];
	properties?: Array<{ property_id?: string; value?: unknown }>;
}

/**
 * Known function-calling chat model ids (from the Workers AI catalog). Used as an
 * extra inclusion signal so we always surface these even if the API's task tagging
 * differs — the dynamic predicate below still adds any other text-generation model
 * the account exposes.
 */
const KNOWN_CHAT_IDS = new Set([
	DEFAULT_MODEL,
	"@cf/moonshotai/kimi-k2.7-code",
	"@cf/moonshotai/kimi-k2.5",
	"@cf/google/gemma-4-26b-a4b-it",
	"@cf/google/gemma-3-12b-it",
	"@cf/meta/llama-4-scout-17b-16e-instruct",
	"@cf/meta/llama-3.3-70b-instruct-fp8-fast",
	"@cf/mistralai/mistral-small-3.1-24b-instruct",
	"@cf/qwen/qwen2.5-coder-32b-instruct"
]);

/** True when a model is text-generation (chat) capable and thus usable by the Copilot. */
const isChatModel = (m: RawModel): boolean => {
	const id = m.name ?? m.id ?? "";
	if (KNOWN_CHAT_IDS.has(id)) return true;
	const task = (m.task?.name ?? "").toLowerCase();
	return task === "text generation";
};

const hasFlag = (m: RawModel, flag: string): boolean => {
	if ((m.tags ?? []).some((t) => t.toLowerCase() === flag)) return true;
	return (m.properties ?? []).some(
		(p) =>
			`${p.property_id ?? ""}`.toLowerCase() === flag &&
			String(p.value ?? "").toLowerCase() !== "false"
	);
};

const toCfModel = (m: RawModel): CfModel => {
	const id = m.name ?? m.id ?? "";
	return {
		id,
		label: id.replace(/^@cf\//, "").replace(/^@hf\//, ""),
		task: m.task?.name ?? "",
		description: m.description ?? "",
		deprecated: hasFlag(m, "deprecated"),
		beta: hasFlag(m, "beta")
	};
};

/**
 * Lists the account's text-generation (chat) models for the picker. Always includes
 * the default model (even if the live catalog momentarily omits it) and sorts it first.
 * Throws `CfInferenceError` on auth/transport failure (callers treat that as "token invalid").
 */
export const listChatModels = async (creds: CloudflareCreds): Promise<CfModel[]> => {
	let res: Response;
	try {
		res = await fetch(`${CF_API}/accounts/${creds.accountId}/ai/models/search?per_page=200`, {
			headers: { Authorization: `Bearer ${creds.apiToken}` }
		});
	} catch (e) {
		throw new CfInferenceError(0, "transport", e instanceof Error ? e.message : "network error");
	}
	if (!res.ok) {
		throw new CfInferenceError(
			res.status,
			kindForStatus(res.status),
			`models/search ${res.status}`
		);
	}

	const json = (await res.json()) as { result?: RawModel[] };
	const chat = (json.result ?? []).filter(isChatModel).map(toCfModel);

	// Guarantee the default is present and first; de-dup by id.
	const byId = new Map<string, CfModel>();
	for (const m of chat) byId.set(m.id, m);
	if (!byId.has(DEFAULT_MODEL)) {
		byId.set(DEFAULT_MODEL, {
			id: DEFAULT_MODEL,
			label: "moonshotai/kimi-k2.6",
			task: "Text Generation",
			description: "Default chat model (Copilot-validated).",
			deprecated: false,
			beta: false
		});
	}

	return [...byId.values()].sort((a, b) => {
		if (a.id === DEFAULT_MODEL) return -1;
		if (b.id === DEFAULT_MODEL) return 1;
		if (a.deprecated !== b.deprecated) return a.deprecated ? 1 : -1;
		return a.id.localeCompare(b.id);
	});
};
