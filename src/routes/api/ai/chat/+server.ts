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
import { loadCloudflareConfig, resolveCloudflareCreds } from "$lib/server/ai/cloudflare-config";
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
import { toolLabel } from "$lib/ai/tool-labels";
import { argSchemas, isKnownToolName } from "$lib/ai/schemas";
import type { Frame, ParsedToolCall } from "$lib/ai/types";

// images: base64 data URLs, max 3, each ≤ ~8 MB (vision attachments).
const bodySchema = z.object({
	conversationId: z.string().nullable().optional(),
	message: z.string().min(1).max(8000),
	images: z.array(z.string().min(1).max(8_000_000)).max(3).optional()
});

// Vision model for image-bearing turns (supports function-calling, so tools stay
// attached and the copilot still tool-calls off a pasted screenshot). Text-only
// turns keep the user's chosen brain model. To disable vision routing, point this
// constant at the brain — the single branch below then never diverges.
const VISION_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";

// A tool-only assistant turn persists with empty content; convey what it did
// (from its tool calls) so the model doesn't re-fire the prior instruction.
const summarizeToolOnlyTurn = (m: AiMessageRow): string => {
	const labels = (m.toolCalls ?? []).map((c) => toolLabel(c.name)).filter(Boolean);
	return labels.length > 0 ? `[Performed: ${labels.join(", ")}]` : m.content;
};

const toHistory = (
	rows: AiMessageRow[]
): Array<{ role: "user" | "assistant" | "system"; content: string }> =>
	rows
		.filter((m) => m.role === "user" || m.role === "assistant")
		.map((m) => ({
			role: m.role as "user" | "assistant",
			content: m.content.trim().length > 0 ? m.content : summarizeToolOnlyTurn(m)
		}));

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
		"Re-issue ONLY the corrected version(s) of the failed call(s) listed above. Do NOT repeat any other tool calls from your previous turn — those already ran. Argument names and types must exactly match each tool's argument schema. If you cannot produce a valid call, reply with a short plain-text explanation instead."
	].join("\n");

/** Retry prompt when the model should have acted on an instruction but called no tool. */
const ACTION_RETRY_MESSAGE =
	"Your previous reply did not call any tool, so nothing changed. The user gave an instruction to change their clients, invoices, payment methods, or sender details. Emit the correct tool call now through the tool interface. Do NOT ask the user to confirm in chat (the UI handles confirmation) and do NOT claim anything was done. Only if the request is genuinely out of scope or impossible, say so plainly in one short sentence.";

/**
 * The gateway chain models intermittently narrate an action ("Done…",
 * "Creating the client…") WITHOUT calling a tool, so nothing runs. We detect
 * the failure from the user's intent (an imperative instruction) rather than
 * the model's wording.
 */
const IMPERATIVE_RE =
	/\b(set|add|change|update|delete|remove|edit|fix|make|apply|append|insert|rename|clear|replace|assign|move|undo|revert|create|correct|adjust|drop|fill|put|toggle|activate|deactivate|enable|disable|select|reorder|polish|rewrite)\b/i;
/** Read-only/interrogative lead words: a message starting with one is a question, not a command. */
const READONLY_LEAD_RE =
	/^(how|what|when|where|which|why|who|is|are|do|does|did|can|could|would|show|tell|list|remind|give)\b/i;
const looksImperative = (text: string): boolean => {
	const t = text.trim();
	if (t.length === 0 || t.endsWith("?")) return false;
	// Don't force a retry on read-only questions phrased without a "?".
	if (READONLY_LEAD_RE.test(t.toLowerCase())) return false;
	return IMPERATIVE_RE.test(t);
};
/** A genuine refusal/clarification we must NOT suppress as a false action narration. */
const REFUSAL_RE =
	/\b(can'?t|cannot|can not|unable|won'?t|not able|out of scope|outside|only help|only assist|don'?t|do not|which|could you|do you want|no client|no invoice)\b/i;
/** A completion claim ("Done", "Updated 5 rows", "I've added…"); only these are blanked when no tool ran. */
const AFFIRMATION_RE =
	/\b(done|updated?|set|added?|applied|appended|inserted|changed|removed|deleted|cleared|renamed|replaced|fixed|marked|created|adjusted|corrected|archived|restored|reordered|shared|i'?ve|i have|i'?ll|all set|here you go)\b/i;

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

	// BYO gate: the Copilot runs inference on the USER's own Cloudflare account.
	// Resolve their creds + model before anything else; 412 (with a connect link) if
	// they haven't connected an account in Settings. Gated before the quota increment
	// so unconnected users never consume quota.
	const resolved = await resolveCloudflareCreds(
		env.TOKEN_ENCRYPTION_KEY ?? "",
		await loadCloudflareConfig(db, userId)
	).catch(() => null);
	if (!resolved) {
		return json(
			{
				error: "Connect your Cloudflare account in Settings to use the copilot.",
				connect: "/settings"
			},
			{ status: 412 }
		);
	}
	const { creds, model } = resolved;
	// Route image-bearing turns to the vision model; text-only turns keep the brain.
	// The corrective retry (also below) reuses this so a vision turn stays on one model.
	const turnModel = parsed.images && parsed.images.length > 0 ? VISION_MODEL : model;

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
			knowledgeText = formatKnowledge(
				await retrieveAppKnowledge({ VECTORIZE: env.VECTORIZE, AI: env.AI }, creds, parsed.message)
			);
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
		let assistantMessageId: string | null = null;

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
			// Buffer the first turn (no live text stream) so we can inspect it for a
			// false action narration before anything reaches the user.
			const first = await consume(
				runChatFrames({
					systemContext,
					history: withFewShots,
					userMessage: userTurn,
					conversationId: activeConversationId,
					images: parsed.images,
					tools: TOOLS_CATALOG,
					cacheKey,
					creds,
					model: turnModel
				}),
				false
			);
			inputTokens += first.inputTokens;
			outputTokens += first.outputTokens;

			let firstCalls = first.toolCalls;
			let firstText = first.text;
			// Recover tool calls the model emitted as plain-text JSON.
			if (firstCalls.length === 0 && !errored && firstText.trim().length > 0) {
				const salvaged = salvageTextToolCalls(firstText);
				if (salvaged.calls.length > 0) {
					firstCalls = salvaged.calls;
					firstText = salvaged.cleanedText;
				}
			}

			let validated = validateToolCalls(decodeCallTokens(firstCalls, context.tokenMap));
			let replyText = firstText;
			const invalid = validated.filter((v) => !v.valid);
			// Turn-1 calls that already passed — kept across an invalid-args retry so a
			// mixed valid+invalid turn doesn't silently drop the user's valid action.
			const firstValid = validated.filter((v) => v.valid);
			const userImperative = looksImperative(parsed.message);
			// Model failed to act: an imperative instruction produced no tool call,
			// and the reply isn't a clarifying question.
			const failedToAct =
				firstCalls.length === 0 && !errored && userImperative && !firstText.includes("?");

			// Exactly one corrective retry: malformed args OR an instruction that
			// produced no tool call (the model narrated instead of calling).
			if ((invalid.length > 0 || failedToAct) && !errored) {
				retried = true;
				console.log(
					JSON.stringify({
						event: "ai.validation_retry",
						turn_id: turnId,
						reason: invalid.length > 0 ? "invalid_args" : "no_tool_call",
						failed: invalid.map((v) => ({ tool: v.call.name, error: v.error }))
					})
				);
				const retryHistory = [
					...withFewShots,
					{ role: "user" as const, content: userTurn },
					{
						role: "assistant" as const,
						content: "[The assistant did not produce a valid tool call.]"
					}
				];
				const retry = await consume(
					runChatFrames({
						systemContext,
						history: retryHistory,
						userMessage: invalid.length > 0 ? correctiveMessage(invalid) : ACTION_RETRY_MESSAGE,
						conversationId: activeConversationId,
						tools: TOOLS_CATALOG,
						creds,
						model: turnModel
					}),
					false
				);
				inputTokens += retry.inputTokens;
				outputTokens += retry.outputTokens;
				let retryCalls = retry.toolCalls;
				let retryText = retry.text;
				// Strip salvaged inline-JSON from the reply on the retry path too, so
				// raw tool-call JSON never reaches the chat bubble or persisted history.
				if (retryCalls.length === 0 && retryText.trim().length > 0) {
					const salvaged = salvageTextToolCalls(retryText);
					if (salvaged.calls.length > 0) {
						retryCalls = salvaged.calls;
						retryText = salvaged.cleanedText;
					}
				}
				const retryValidated = validateToolCalls(decodeCallTokens(retryCalls, context.tokenMap));
				// Invalid-args retry: merge the preserved turn-1 valid calls with the
				// retry's calls (the corrective prompt told the model not to repeat them).
				// The no-tool-call branch had no valid turn-1 calls, so it just replaces.
				validated = invalid.length > 0 ? [...firstValid, ...retryValidated] : retryValidated;
				replyText = retryText;
			}

			// Only valid calls reach the client/D1.
			finalCalls = validated.filter((v) => v.valid).map((v) => v.call);
			successCount = finalCalls.length;

			// Never let an action narration stand when no tool ran; genuine refusals
			// and clarifying questions are preserved.
			let outText = replyText;
			if (
				successCount === 0 &&
				userImperative &&
				!outText.includes("?") &&
				!REFUSAL_RE.test(outText) &&
				AFFIRMATION_RE.test(outText)
			) {
				outText = "";
			}
			if (failedToAct && successCount === 0 && outText.trim().length === 0) {
				outText = "I couldn't apply that change — could you rephrase your request?";
			}
			assistantText = outText;

			if (outText.trim().length > 0) {
				push({ t: "text", delta: outText });
			}
			for (const call of finalCalls) {
				push({ t: "tool_call", id: call.id, name: call.name, args: call.args });
			}

			const toolCalls: AiMessageToolCall[] = finalCalls.map((c) => ({
				id: c.id,
				name: c.name,
				args: c.args
			}));
			const assistantMessage = await appendMessage(db, activeConversationId, {
				role: "assistant",
				content: assistantText,
				toolCalls: toolCalls.length > 0 ? toolCalls : null,
				toolResults: null,
				inputTokens,
				outputTokens
			});
			// Surface the persisted id so the client can PATCH tool outcomes back.
			assistantMessageId = assistantMessage.id;
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
			messageId: assistantMessageId,
			inputTokens,
			outputTokens
		});
	});
};
