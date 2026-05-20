import { ai } from "$lib/stores/ai.svelte";
import {
	executeToolCall,
	type ConfirmationRequest,
	type ExecutionFrame,
	type PolishApprovalRequest
} from "./executor";
import { streamFrames, type Frame } from "./streaming";
import type { AnomalySettings, ParsedToolCall } from "./types";

interface SendOptions {
	signal?: AbortSignal;
	onConversationCreated?: (id: string) => void;
}

interface RawAssistantMessage {
	id: string;
	role: "user" | "assistant" | "tool" | "system";
	content: string;
	toolCalls: Array<{ id: string; name: string; args: unknown }> | null;
	toolResults: Array<{ id: string; status: string; error?: string; actionId?: string }> | null;
	createdAt: string;
}

const requestConfirmation = (req: ConfirmationRequest): Promise<boolean> =>
	new Promise((resolve) => {
		ai.enqueueConfirmation({
			toolCallId: req.toolCallId,
			toolName: req.toolName,
			args: req.args,
			tier: req.tier,
			anomalies: req.anomalies,
			humanLabel: req.humanLabel,
			diff: req.diff,
			inverseSummary: req.inverseSummary,
			resolve: (approved: boolean) => {
				ai.dequeueConfirmation(req.toolCallId);
				resolve(approved);
			}
		});
	});

const requestPolishApproval =
	(assistantId: string) =>
	(req: PolishApprovalRequest): Promise<boolean> =>
		new Promise((resolve) => {
			ai.updateToolCall(assistantId, req.toolCallId, {
				status: "pending_confirmation",
				polish: { oldText: req.oldText, newText: req.newText, target: req.target }
			});
			ai.enqueuePolish({
				toolCallId: req.toolCallId,
				resolve: (approved: boolean) => {
					ai.dequeuePolish(req.toolCallId);
					resolve(approved);
				}
			});
		});

const fetchUpdatedAppState = async (): Promise<void> => {
	try {
		const mod = await import("$app/navigation");
		await mod.invalidateAll();
	} catch (err) {
		console.error("[ai] failed to invalidate", err);
	}
};

export const sendMessage = async (message: string, options: SendOptions = {}): Promise<void> => {
	const conversationId = ai.activeConversationId;
	const userMessageId = crypto.randomUUID();
	ai.appendUserMessage(userMessageId, message);

	const assistantId = crypto.randomUUID();
	ai.startAssistantMessage(assistantId);
	ai.setError(null);
	ai.setStreaming(true);

	const collectedToolCalls: ParsedToolCall[] = [];
	let assignedConversationId: string | null = conversationId;

	try {
		const response = await fetch("/api/ai/chat", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ conversationId, message }),
			signal: options.signal
		});

		if (!response.ok) {
			let payload: unknown = null;
			try {
				payload = await response.json();
			} catch {
				/* ignore */
			}
			const msg =
				(payload as { message?: string } | null)?.message ?? `Request failed (${response.status})`;
			ai.appendAssistantDelta(assistantId, msg);
			ai.finalizeAssistantMessage(assistantId);
			ai.setError(msg);
			ai.setStreaming(false);
			return;
		}

		if (!response.body) {
			ai.setError("Empty response");
			ai.finalizeAssistantMessage(assistantId);
			ai.setStreaming(false);
			return;
		}

		for await (const frame of streamFrames(response.body)) {
			if (frame.t === "text") {
				ai.appendAssistantDelta(assistantId, frame.delta);
			} else if (frame.t === "tool_call") {
				collectedToolCalls.push({ id: frame.id, name: frame.name, args: frame.args });
				ai.attachToolCall(assistantId, {
					id: frame.id,
					name: frame.name,
					args: frame.args
				});
			} else if (frame.t === "anomaly") {
				ai.updateToolCall(assistantId, frame.toolCallId, {
					anomalies: frame.reasons.map((r) => ({
						key: r.split(":")[0] as never,
						reason: r
					}))
				});
			} else if (frame.t === "end") {
				if (!assignedConversationId) {
					assignedConversationId = frame.turnId;
					ai.setActiveConversation(assignedConversationId);
					options.onConversationCreated?.(assignedConversationId);
				}
			} else if (frame.t === "error") {
				ai.setError(frame.message);
			}
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Stream failed";
		ai.setError(msg);
		ai.appendAssistantDelta(assistantId, `\n\n[error: ${msg}]`);
	}

	ai.finalizeAssistantMessage(assistantId);
	ai.setStreaming(false);

	if (collectedToolCalls.length === 0) return;

	const settings: AnomalySettings = ai.anomalySettings;
	const onResult = (frame: ExecutionFrame) => {
		if (frame.t === "tool_result") {
			ai.updateToolCall(assistantId, frame.id, {
				status: frame.status,
				actionId: frame.actionId ?? null,
				error: frame.error ?? null
			});
		} else if (frame.t === "anomaly") {
			ai.updateToolCall(assistantId, frame.toolCallId, {
				anomalies: frame.reasons.map((r) => ({
					key: r.split(":")[0] as never,
					reason: r
				}))
			});
		}
	};

	let needsReload = false;
	for (const call of collectedToolCalls) {
		const outcome = await executeToolCall(call, {
			conversationId: assignedConversationId,
			messageId: null,
			anomalySettings: settings,
			requestConfirmation,
			requestPolishApproval: requestPolishApproval(assistantId),
			onResult
		});
		if (outcome.status === "applied") {
			needsReload = true;
			fireToast({
				type: "success",
				message: `Applied ${call.name}`,
				actionId: outcome.actionId
			});
		} else if (outcome.status === "failed") {
			fireToast({ type: "error", message: outcome.error ?? "Tool failed" });
		}
	}

	if (needsReload) {
		await ai.reloadActions();
		await fetchUpdatedAppState();
	}
};

const fireToast = async (input: {
	type: "success" | "error" | "info";
	message: string;
	actionId?: string | null;
}) => {
	try {
		const { toast } = await import("svelte-sonner");
		if (input.type === "success") {
			toast.success(input.message, {
				duration: 10000,
				action: input.actionId
					? { label: "Undo", onClick: () => triggerUndo(input.actionId!) }
					: undefined
			});
		} else if (input.type === "error") {
			toast.error(input.message);
		} else {
			toast(input.message);
		}
	} catch {
		/* sonner not loaded yet */
	}
};

export const triggerUndo = async (actionId: string): Promise<boolean> => {
	try {
		const response = await fetch(`/api/ai/undo/${actionId}`, {
			method: "POST",
			headers: { "content-type": "application/json" }
		});
		if (!response.ok) {
			const text = await response.text();
			ai.markHistoryActionUndoFailed(actionId, text || "Undo failed");
			fireToast({ type: "error", message: text || "Undo failed" });
			return false;
		}
		ai.markHistoryActionUndone(actionId);
		await fetchUpdatedAppState();
		fireToast({ type: "info", message: "Reverted" });
		return true;
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Undo failed";
		ai.markHistoryActionUndoFailed(actionId, msg);
		fireToast({ type: "error", message: msg });
		return false;
	}
};

export const deleteAction = async (actionId: string): Promise<void> => {
	try {
		await fetch(`/api/ai/actions/${actionId}`, { method: "DELETE" });
		ai.removeHistoryAction(actionId);
	} catch (err) {
		console.error("[ai] failed to delete action", err);
	}
};

export const createNewConversation = async (): Promise<void> => {
	try {
		const response = await fetch("/api/ai/conversations", { method: "POST" });
		if (!response.ok) return;
		const conv = (await response.json()) as { id: string; title: string; updatedAt: string };
		ai.upsertConversation(conv);
		ai.setActiveConversation(conv.id);
		ai.clearMessages();
	} catch (err) {
		console.error("[ai] failed to create conversation", err);
	}
};

export const switchConversation = async (id: string): Promise<void> => {
	if (ai.activeConversationId === id) return;
	ai.setActiveConversation(id);
	try {
		const response = await fetch(`/api/ai/messages?conversationId=${encodeURIComponent(id)}`);
		if (!response.ok) return;
		const raw = (await response.json()) as RawAssistantMessage[];
		ai.replaceMessages(
			raw.map((m) => ({
				id: m.id,
				role: m.role,
				content: m.content,
				toolCalls: (m.toolCalls ?? []).map((tc) => {
					const result = m.toolResults?.find((r) => r.id === tc.id);
					return {
						id: tc.id,
						name: tc.name,
						args: tc.args,
						status: (result?.status as "applied" | "rejected" | "failed" | undefined) ?? "applied",
						actionId: result?.actionId ?? null,
						error: result?.error ?? null,
						anomalies: [],
						undone: false
					};
				}),
				createdAt: m.createdAt,
				streaming: false
			}))
		);
	} catch (err) {
		console.error("[ai] failed to load messages", err);
	}
};

export const renameConversation = async (id: string, title: string): Promise<void> => {
	const trimmed = title.trim();
	if (!trimmed) return;
	try {
		const response = await fetch(`/api/ai/conversations/${id}`, {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ title: trimmed })
		});
		if (response.ok) {
			ai.upsertConversation({
				id,
				title: trimmed,
				updatedAt: new Date().toISOString()
			});
		}
	} catch (err) {
		console.error("[ai] failed to rename", err);
	}
};

export const deleteConversation = async (id: string): Promise<void> => {
	try {
		await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" });
		ai.removeConversation(id);
		if (ai.activeConversationId === id) {
			ai.clearMessages();
		}
	} catch (err) {
		console.error("[ai] failed to delete conversation", err);
	}
};

export const respondToConfirmation = (toolCallId: string, approved: boolean): void => {
	const req = ai.pendingConfirmations.find((c) => c.toolCallId === toolCallId);
	if (req) req.resolve(approved);
};

export const respondToPolish = (toolCallId: string, approved: boolean): void => {
	const req = ai.pendingPolish.find((p) => p.toolCallId === toolCallId);
	if (req) req.resolve(approved);
};

export const respondToAllConfirmations = (approved: boolean): void => {
	for (const req of [...ai.pendingConfirmations]) {
		req.resolve(approved);
	}
};

export type { Frame };
