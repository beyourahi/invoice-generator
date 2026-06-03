import { error, json } from "@sveltejs/kit";
import { z } from "zod";
import type { RequestHandler } from "./$types";
import { requireApiContext } from "$lib/server/api";
import { loadAppState } from "$lib/server/repositories/state";
import {
	createConversation,
	getConversation,
	touchUpdatedAt
} from "$lib/server/repositories/ai-conversations";
import {
	appendMessage,
	listMessages,
	type AiMessageRow,
	type AiMessageToolCall
} from "$lib/server/repositories/ai-messages";
import { checkAndIncrementQuota } from "$lib/server/ai-quota";
import { checkSpendCap, recordSpend } from "$lib/server/ai-spend";
import { logChatTurn } from "$lib/server/log";
import { projectAppState, decodeTokens } from "$lib/ai/context";
import {
	buildSystemContext,
	buildUserTurn,
	titleFromMessage,
	PROMPT_VERSION,
	FEW_SHOTS
} from "$lib/ai/prompts";
import { runChatFrames, type RawChatResult } from "$lib/ai/client";
import { salvageTextToolCalls } from "$lib/ai/salvage";
import { sseStream } from "$lib/ai/streaming";
import { windowHistory } from "$lib/ai/window";
import { retrieveAppKnowledge, formatKnowledge } from "$lib/ai/rag";
import { TOOLS_CATALOG } from "$lib/ai/tools-catalog";
import { argSchemas, isKnownToolName } from "$lib/ai/schemas";
import type { Frame, ParsedToolCall } from "$lib/ai/types";

// images: base64 data URLs, max 3, each ≤ ~8 MB (vision attachments).
const bodySchema = z.object({
	conversationId: z.string().nullable().optional(),
	message: z.string().min(1).max(8000),
	images: z.array(z.string().min(1).max(8_000_000)).max(3).optional()
});

const toHistory = (
	rows: AiMessageRow[]
): Array<{ role: "user" | "assistant" | "system"; content: string }> =>
	rows
		.filter((m) => m.role === "user" || m.role === "assistant")
		.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

const sha256Hex = async (input: string): Promise<string> => {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
};

interface ValidatedCall {
	call: ParsedToolCall;
	valid: boolean;
	error?: string;
}

const decodeCallTokens = (
	calls: ParsedToolCall[],
	tokenMap: Record<string, string>
): ParsedToolCall[] => calls.map((call) => ({ ...call, args: decodeTokens(call.args, tokenMap) }));

// Gates each model-emitted tool call against the per-tool Zod arg schema.
// Unknown tool name or arg-schema failure → valid:false (triggers one retry turn).
// On success, call.args is replaced with the parsed/coerced data.
const validateToolCalls = (calls: ParsedToolCall[]): ValidatedCall[] =>
	calls.map((call) => {
		if (!isKnownToolName(call.name)) {
			return { call, valid: false, error: `Unknown tool "${call.name}"` };
		}
		const result = argSchemas[call.name].safeParse(call.args ?? {});
		if (!result.success) {
			return {
				call,
				valid: false,
				error: result.error.issues[0]?.message ?? "Invalid arguments"
			};
		}
		return { call: { ...call, args: result.data }, valid: true };
	});

const correctiveMessage = (invalid: ValidatedCall[]): string =>
	[
		"Your previous tool call(s) failed schema validation:",
		...invalid.map((v) => `- "${v.call.name}": ${v.error}`),
		"",
		"Re-issue the corrected tool call(s) now. Argument names and types must exactly match each tool's argument schema. If you cannot produce a valid call, reply with a short plain-text explanation instead."
	].join("\n");

/**
 * POST /api/ai/chat — runs one Copilot turn and streams the result as SSE.
 *
 * CONTRACT:
 *  - body: { conversationId?, message, images? } (see bodySchema). Auth + D1 via requireApiContext.
 *  - response: text/event-stream of Frames (text deltas, tool_call, error, end).
 *  - SIDE EFFECTS: creates the conversation if absent; appends the user message
 *    then the assistant message to D1; records token spend; touches updatedAt;
 *    structured-logs the turn.
 *  - ERROR MODES: 401/503 (requireApiContext), 503 if AI binding missing, 400 on
 *    body parse failure, 429 on daily-quota or monthly-spend-cap (returned as JSON,
 *    NOT thrown — quota check must increment before model runs). Mid-stream model
 *    failures arrive as an SSE error frame, not an HTTP status.
 *
 * FLOW NOTES:
 *  - RAG app-knowledge is retrieved only when VECTORIZE is bound, and fails open
 *    (empty knowledge) so chat never breaks on a RAG error.
 *  - State is tokenized (cli_/ent_/pm_) before going to the model; returned tool
 *    args are decoded back via context.tokenMap before validation/streaming.
 *  - cacheKey = sha256(PROMPT_VERSION|state|message) — versioned so prompt changes invalidate.
 *  - On schema-invalid tool calls, issues exactly ONE corrective retry turn (with
 *    streamText disabled) before persisting whatever it gets. salvageTextToolCalls
 *    recovers tool calls the model emitted as plain-text JSON.
 *  - FEW_SHOTS are prepended only for an empty (first-turn) conversation.
 */
export const POST: RequestHandler = async (event) => {
	const start = Date.now();
	const { db, userId } = requireApiContext(event);
	const env = event.platform?.env;
	if (!env?.AI) {
		throw error(503, "AI binding not available");
	}

	let parsed: z.infer<typeof bodySchema>;
	try {
		parsed = bodySchema.parse(await event.request.json());
	} catch (err) {
		throw error(400, err instanceof Error ? err.message : "Invalid request body");
	}

	const quota = await checkAndIncrementQuota(env.AI_QUOTA_KV, userId);
	if (!quota.allowed) {
		return json(
			{
				code: "quota_exceeded",
				message: `Daily AI quota reached (${quota.count}/${quota.limit}). Resets at ${quota.resetsAt}.`,
				resetsAt: quota.resetsAt
			},
			{ status: 429 }
		);
	}

	const spend = await checkSpendCap(env.AI_QUOTA_KV, userId, env.AI_MONTHLY_CAP_USD);
	if (!spend.allowed) {
		return json(
			{
				code: "spend_cap_reached",
				message: `Monthly AI spend cap reached ($${spend.spentUsd.toFixed(2)} of $${spend.capUsd.toFixed(2)}). Resets at the start of next month.`
			},
			{ status: 429 }
		);
	}

	const requestedId = parsed.conversationId ?? null;
	let conversation = requestedId ? await getConversation(db, userId, requestedId) : null;
	if (!conversation) {
		conversation = await createConversation(db, userId, titleFromMessage(parsed.message));
	}
	const activeConversationId = conversation.id;

	const history = windowHistory(toHistory(await listMessages(db, activeConversationId, 100)));

	await appendMessage(db, activeConversationId, {
		role: "user",
		content: parsed.message
	});

	const appState = await loadAppState(db, userId);
	const context = projectAppState(appState);
	const systemContext = buildSystemContext(TOOLS_CATALOG);
	const withFewShots = history.length === 0 ? [...FEW_SHOTS, ...history] : history;
	let knowledgeText = "";
	if (env.VECTORIZE) {
		try {
			knowledgeText = formatKnowledge(await retrieveAppKnowledge(env, parsed.message));
		} catch {
			knowledgeText = "";
		}
	}
	const userTurn = buildUserTurn({
		message: parsed.message,
		stateText: context.summaryText,
		knowledgeText,
		dateText: new Date().toISOString().slice(0, 10)
	});
	const cacheKey = await sha256Hex(`${PROMPT_VERSION}|${context.summaryText}|${parsed.message}`);
	const turnId = crypto.randomUUID();

	return sseStream(async (push) => {
		let assistantText = "";
		let inputTokens = 0;
		let outputTokens = 0;
		let errored: string | null = null;
		let retried = false;
		let finalCalls: ParsedToolCall[] = [];
		let successCount = 0;

		const consume = async (
			gen: AsyncGenerator<Frame, RawChatResult>,
			streamText: boolean
		): Promise<RawChatResult> => {
			let step = await gen.next();
			while (!step.done) {
				const frame = step.value;
				if (frame.t === "text" && streamText) {
					assistantText += frame.delta;
					push(frame);
				} else if (frame.t === "error") {
					errored = frame.message;
					push(frame);
				}
				step = await gen.next();
			}
			return step.value;
		};

		try {
			const first = await consume(
				runChatFrames(env, {
					systemContext,
					history: withFewShots,
					userMessage: userTurn,
					conversationId: activeConversationId,
					images: parsed.images,
					tools: TOOLS_CATALOG,
					cacheKey
				}),
				true
			);
			inputTokens += first.inputTokens;
			outputTokens += first.outputTokens;

			let firstCalls = first.toolCalls;
			if (firstCalls.length === 0 && !errored && assistantText.trim().length > 0) {
				const salvaged = salvageTextToolCalls(assistantText);
				if (salvaged.calls.length > 0) {
					firstCalls = salvaged.calls;
					assistantText = salvaged.cleanedText;
				}
			}

			let validated = validateToolCalls(decodeCallTokens(firstCalls, context.tokenMap));
			const invalid = validated.filter((v) => !v.valid);

			if (invalid.length > 0 && !errored) {
				retried = true;
				console.log(
					JSON.stringify({
						event: "ai.validation_retry",
						turn_id: turnId,
						failed: invalid.map((v) => ({ tool: v.call.name, error: v.error }))
					})
				);
				const retryHistory = [
					...withFewShots,
					{ role: "user" as const, content: userTurn },
					{
						role: "assistant" as const,
						content: `${first.text}\n\n[Attempted tool calls: ${JSON.stringify(
							first.toolCalls.map((c) => ({ name: c.name, args: c.args }))
						)}]`
					}
				];
				const retry = await consume(
					runChatFrames(env, {
						systemContext,
						history: retryHistory,
						userMessage: correctiveMessage(invalid),
						conversationId: activeConversationId,
						tools: TOOLS_CATALOG
					}),
					false
				);
				inputTokens += retry.inputTokens;
				outputTokens += retry.outputTokens;
				let retryCalls = retry.toolCalls;
				if (retryCalls.length === 0 && retry.text.trim().length > 0) {
					const salvaged = salvageTextToolCalls(retry.text);
					if (salvaged.calls.length > 0) retryCalls = salvaged.calls;
				}
				validated = validateToolCalls(decodeCallTokens(retryCalls, context.tokenMap));
			}

			finalCalls = validated.map((v) => v.call);
			successCount = validated.filter((v) => v.valid).length;

			for (const call of finalCalls) {
				push({ t: "tool_call", id: call.id, name: call.name, args: call.args });
			}

			const toolCalls: AiMessageToolCall[] = finalCalls.map((c) => ({
				id: c.id,
				name: c.name,
				args: c.args
			}));
			await appendMessage(db, activeConversationId, {
				role: "assistant",
				content: assistantText,
				toolCalls: toolCalls.length > 0 ? toolCalls : null,
				toolResults: null,
				inputTokens,
				outputTokens
			});
			await touchUpdatedAt(db, activeConversationId);
			await recordSpend(env.AI_QUOTA_KV, userId, inputTokens, outputTokens);
		} catch (err) {
			errored = err instanceof Error ? err.message : "Stream failed";
			push({ t: "error", message: errored });
		}

		await logChatTurn({
			userId,
			conversationId: activeConversationId,
			turnId,
			inputTokens,
			outputTokens,
			toolCallCount: finalCalls.length,
			toolCallSuccessCount: successCount,
			latencyMs: Date.now() - start,
			promptVersion: PROMPT_VERSION,
			retried,
			error: errored ?? undefined
		});

		push({
			t: "end",
			turnId,
			conversationId: activeConversationId,
			inputTokens,
			outputTokens
		});
	});
};
