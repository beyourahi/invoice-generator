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
import { logChatTurn } from "$lib/server/log";
import { projectAppState } from "$lib/ai/context";
import {
	buildSystemContext,
	titleFromMessage,
	PROMPT_VERSION,
	FEW_SHOTS_V1
} from "$lib/ai/prompts";
import { runChatFrames } from "$lib/ai/client";
import { sseStream } from "$lib/ai/streaming";
import { TOOLS_CATALOG } from "$lib/ai/tools-catalog";

const bodySchema = z.object({
	conversationId: z.string().nullable().optional(),
	message: z.string().min(1).max(8000)
});

const toHistory = (
	rows: AiMessageRow[]
): Array<{ role: "user" | "assistant" | "system"; content: string }> =>
	rows
		.filter((m) => m.role === "user" || m.role === "assistant")
		.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

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

	const requestedId = parsed.conversationId ?? null;
	let conversation = requestedId ? await getConversation(db, userId, requestedId) : null;
	if (!conversation) {
		conversation = await createConversation(db, userId, titleFromMessage(parsed.message));
	}
	const activeConversationId = conversation.id;

	const history = toHistory(await listMessages(db, activeConversationId, 100));

	await appendMessage(db, activeConversationId, {
		role: "user",
		content: parsed.message
	});

	const appState = await loadAppState(db, userId);
	const context = projectAppState(appState);

	const systemContext = buildSystemContext(context, TOOLS_CATALOG);
	const withFewShots = history.length === 0 ? [...FEW_SHOTS_V1, ...history] : history;

	return sseStream(async (push) => {
		let assistantText = "";
		const toolCalls: AiMessageToolCall[] = [];
		let inputTokens = 0;
		let outputTokens = 0;
		let errored: string | null = null;

		try {
			const gen = runChatFrames(
				{
					AI: env.AI,
					AI_GATEWAY_SLUG: env.AI_GATEWAY_SLUG,
					CLOUDFLARE_ACCOUNT_ID: undefined
				},
				{
					systemContext,
					history: withFewShots,
					userMessage: parsed.message,
					tools: TOOLS_CATALOG
				}
			);

			while (true) {
				const next = await gen.next();
				if (next.done) {
					break;
				}
				const frame = next.value;
				if (frame.t === "text") {
					assistantText += frame.delta;
				} else if (frame.t === "tool_call") {
					toolCalls.push({ id: frame.id, name: frame.name, args: frame.args });
				} else if (frame.t === "end") {
					inputTokens = frame.inputTokens;
					outputTokens = frame.outputTokens;
				} else if (frame.t === "error") {
					errored = frame.message;
				}
				push(frame);
			}
		} catch (err) {
			errored = err instanceof Error ? err.message : "Stream failed";
			push({ t: "error", message: errored });
		}

		await appendMessage(db, activeConversationId, {
			role: "assistant",
			content: assistantText,
			toolCalls: toolCalls.length > 0 ? toolCalls : null,
			toolResults: null,
			inputTokens,
			outputTokens
		});
		await touchUpdatedAt(db, activeConversationId);

		await logChatTurn({
			userId,
			conversationId: activeConversationId,
			turnId: crypto.randomUUID(),
			inputTokens,
			outputTokens,
			toolCallCount: toolCalls.length,
			toolCallSuccessCount: 0,
			latencyMs: Date.now() - start,
			promptVersion: PROMPT_VERSION,
			error: errored ?? undefined
		});

		push({
			t: "end",
			turnId: activeConversationId,
			inputTokens,
			outputTokens
		});
	});
};
