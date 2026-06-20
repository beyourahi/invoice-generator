/**
 * The `ai` Copilot store — factory function + $state closure exported as a
 * singleton (Svelte 5 $state reactivity is scoped to its declaration, hence the
 * factory). Holds conversations, messages, streaming status, the Tier-B
 * confirmation + polish queues, undo history, anomaly settings (persisted to
 * localStorage, NOT D1), pending vision images (max 3), and mobile/rail UI state.
 * INVARIANT: hydrate() is called ONCE in +page.svelte via untrack — do not add a
 * second hydrate path. NOTE: hydrate deliberately ignores payload.anomalySettings
 * and reads localStorage instead (client-owned setting).
 * @see $lib/ai/chat-client.ts (primary mutator).
 */

import { api, sync } from "$lib/api/client";
import type {
	AnomalyResult,
	AnomalySettings,
	ConfirmationDiffRow,
	ParsedToolCall,
	SafetyTier
} from "$lib/ai/types";
import { DEFAULT_ANOMALY_SETTINGS } from "$lib/ai/types";

const ANOMALY_STORAGE_KEY = "invoice-gen:ai-anomaly-settings";

const loadStoredAnomalySettings = (): AnomalySettings => {
	if (typeof localStorage === "undefined") return { ...DEFAULT_ANOMALY_SETTINGS };
	try {
		const raw = localStorage.getItem(ANOMALY_STORAGE_KEY);
		if (!raw) return { ...DEFAULT_ANOMALY_SETTINGS };
		const parsed = JSON.parse(raw) as Partial<AnomalySettings>;
		return { ...DEFAULT_ANOMALY_SETTINGS, ...parsed };
	} catch {
		return { ...DEFAULT_ANOMALY_SETTINGS };
	}
};

const persistAnomalySettings = (settings: AnomalySettings): void => {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(ANOMALY_STORAGE_KEY, JSON.stringify(settings));
	} catch {
		/* ignore quota / privacy errors */
	}
};

export type AiMessageRole = "user" | "assistant" | "tool" | "system";

export interface AiPolishProposal {
	oldText: string;
	newText: string;
	target: string;
}

export interface AiToolCall {
	id: string;
	name: string;
	args: unknown;
	status: "pending" | "pending_confirmation" | "applied" | "rejected" | "failed";
	actionId: string | null;
	error: string | null;
	anomalies: AnomalyResult[];
	undone: boolean;
	polish?: AiPolishProposal;
}

export interface AiMessage {
	id: string;
	role: AiMessageRole;
	content: string;
	toolCalls: AiToolCall[];
	createdAt: string;
	streaming: boolean;
	/** Data-URL previews when the user attached images to this turn (max 3). */
	images?: string[];
}

export interface AiConversation {
	id: string;
	title: string;
	updatedAt: string;
}

export interface AiHistoryAction {
	id: string;
	conversationId: string | null;
	messageId: string | null;
	toolName: string;
	inputs: unknown;
	inverse: unknown;
	safetyTier: SafetyTier;
	requiredConfirmation: boolean;
	anomalyTriggered: string | null;
	applied: boolean;
	status: "applied" | "rejected" | "failed" | "undone" | "undo_failed";
	error: string | null;
	createdAt: string;
	undoneAt: string | null;
}

export interface PendingConfirmation {
	toolCallId: string;
	toolName: string;
	args: unknown;
	tier: SafetyTier;
	anomalies: AnomalyResult[];
	humanLabel: string;
	diff: ConfirmationDiffRow[];
	inverseSummary: string;
	resolve: (approved: boolean) => void;
}

export interface PendingPolish {
	toolCallId: string;
	resolve: (approved: boolean) => void;
}

export interface AiHydrationPayload {
	enabled: boolean;
	activeConversation: AiConversation | null;
	conversations: AiConversation[];
	messages: AiMessage[];
	recentActions: AiHistoryAction[];
	anomalySettings: AnomalySettings;
}

const createAiStore = () => {
	let enabled = $state(true);
	let activeConversationId = $state<string | null>(null);
	let conversations = $state<AiConversation[]>([]);
	let messages = $state<AiMessage[]>([]);
	let pendingConfirmations = $state<PendingConfirmation[]>([]);
	let pendingPolish = $state<PendingPolish[]>([]);
	let railOpen = $state(false);
	let historyActions = $state<AiHistoryAction[]>([]);
	let showUndone = $state(false);
	let streaming = $state(false);
	let inputBusy = $state(false);
	let error = $state<string | null>(null);
	let anomalySettings = $state<AnomalySettings>({ ...DEFAULT_ANOMALY_SETTINGS });
	let mobileOpen = $state(false);
	let desktopOpen = $state(false);
	let inputFocusNonce = $state(0);
	let pendingImages = $state<string[]>([]);

	const MAX_PENDING_IMAGES = 3;

	const addPendingImage = (dataUrl: string) => {
		if (pendingImages.length >= MAX_PENDING_IMAGES) return;
		pendingImages = [...pendingImages, dataUrl];
	};

	const removePendingImage = (index: number) => {
		pendingImages = pendingImages.filter((_, i) => i !== index);
	};

	const clearPendingImages = () => {
		pendingImages = [];
	};

	// Active conversation is hoisted to the front of the list so it sorts first in the picker.
	// anomalySettings comes from localStorage, intentionally overriding payload.anomalySettings.
	const hydrate = (payload: AiHydrationPayload) => {
		enabled = payload.enabled;
		activeConversationId = payload.activeConversation?.id ?? null;
		conversations = payload.activeConversation
			? [
					payload.activeConversation,
					...payload.conversations.filter((c) => c.id !== payload.activeConversation?.id)
				]
			: payload.conversations;
		messages = payload.messages;
		historyActions = payload.recentActions;
		anomalySettings = loadStoredAnomalySettings();
	};

	const setEnabled = (v: boolean) => {
		enabled = v;
	};

	const setMobileOpen = (open: boolean) => {
		mobileOpen = open;
	};

	// Desktop rail visibility (lg+). Separate from `railOpen` (the in-rail history
	// sub-panel) and `mobileOpen` (the <lg sheet). Default closed; not persisted.
	const openDesktop = () => {
		desktopOpen = true;
	};

	const closeDesktop = () => {
		desktopOpen = false;
	};

	const toggleDesktop = () => {
		desktopOpen = !desktopOpen;
	};

	const requestInputFocus = () => {
		inputFocusNonce++;
	};

	const toggleRail = () => {
		railOpen = !railOpen;
	};

	const closeRail = () => {
		railOpen = false;
	};

	const setShowUndone = (v: boolean) => {
		showUndone = v;
	};

	const setError = (msg: string | null) => {
		error = msg;
	};

	// Streaming and input-busy are tied together: an in-flight turn locks the composer.
	const setStreaming = (v: boolean) => {
		streaming = v;
		inputBusy = v;
	};

	const updateAnomalySettings = (next: Partial<AnomalySettings>) => {
		anomalySettings = { ...anomalySettings, ...next };
		persistAnomalySettings(anomalySettings);
	};

	const appendUserMessage = (id: string, content: string, images?: string[]) => {
		messages = [
			...messages,
			{
				id,
				role: "user",
				content,
				toolCalls: [],
				createdAt: new Date().toISOString(),
				streaming: false,
				...(images && images.length > 0 ? { images } : {})
			}
		];
	};

	const startAssistantMessage = (id: string) => {
		messages = [
			...messages,
			{
				id,
				role: "assistant",
				content: "",
				toolCalls: [],
				createdAt: new Date().toISOString(),
				streaming: true
			}
		];
	};

	const appendAssistantDelta = (id: string, delta: string) => {
		messages = messages.map((m) => (m.id === id ? { ...m, content: m.content + delta } : m));
	};

	const finalizeAssistantMessage = (id: string) => {
		messages = messages.map((m) => (m.id === id ? { ...m, streaming: false } : m));
	};

	const attachToolCall = (messageId: string, call: ParsedToolCall) => {
		messages = messages.map((m) =>
			m.id === messageId
				? {
						...m,
						toolCalls: [
							...m.toolCalls,
							{
								id: call.id,
								name: call.name,
								args: call.args,
								status: "pending",
								actionId: null,
								error: null,
								anomalies: [],
								undone: false
							}
						]
					}
				: m
		);
	};

	const updateToolCall = (messageId: string, toolCallId: string, patch: Partial<AiToolCall>) => {
		messages = messages.map((m) =>
			m.id === messageId
				? {
						...m,
						toolCalls: m.toolCalls.map((tc) => (tc.id === toolCallId ? { ...tc, ...patch } : tc))
					}
				: m
		);
	};

	const enqueueConfirmation = (req: PendingConfirmation) => {
		pendingConfirmations = [...pendingConfirmations, req];
	};

	const dequeueConfirmation = (toolCallId: string) => {
		pendingConfirmations = pendingConfirmations.filter((c) => c.toolCallId !== toolCallId);
	};

	const enqueuePolish = (req: PendingPolish) => {
		pendingPolish = [...pendingPolish, req];
	};

	const dequeuePolish = (toolCallId: string) => {
		pendingPolish = pendingPolish.filter((p) => p.toolCallId !== toolCallId);
	};

	const setActiveConversation = (id: string | null) => {
		activeConversationId = id;
	};

	const upsertConversation = (conv: AiConversation) => {
		const exists = conversations.some((c) => c.id === conv.id);
		conversations = exists
			? conversations.map((c) => (c.id === conv.id ? conv : c))
			: [conv, ...conversations];
	};

	const replaceConversations = (list: AiConversation[]) => {
		conversations = list;
	};

	const removeConversation = (id: string) => {
		conversations = conversations.filter((c) => c.id !== id);
		if (activeConversationId === id) {
			activeConversationId = conversations[0]?.id ?? null;
			messages = [];
		}
	};

	const replaceMessages = (list: AiMessage[]) => {
		messages = list;
	};

	const clearMessages = () => {
		messages = [];
	};

	const pushHistoryAction = (action: AiHistoryAction) => {
		historyActions = [action, ...historyActions].slice(0, 200);
	};

	const replaceHistoryActions = (list: AiHistoryAction[]) => {
		historyActions = list;
	};

	// Marks the history row undone AND flips the matching message tool-call badge (joined by actionId).
	const markHistoryActionUndone = (id: string) => {
		historyActions = historyActions.map((a) =>
			a.id === id ? { ...a, status: "undone", undoneAt: new Date().toISOString() } : a
		);
		messages = messages.map((m) => ({
			...m,
			toolCalls: m.toolCalls.map((tc) => (tc.actionId === id ? { ...tc, undone: true } : tc))
		}));
	};

	const markHistoryActionUndoFailed = (id: string, error: string) => {
		historyActions = historyActions.map((a) =>
			a.id === id ? { ...a, status: "undo_failed", error } : a
		);
	};

	const removeHistoryAction = (id: string) => {
		historyActions = historyActions.filter((a) => a.id !== id);
	};

	const reloadActions = async () => {
		const list = await sync(() => api.get<AiHistoryAction[]>("/api/ai/actions?limit=50"));
		if (list) historyActions = list;
	};

	const reloadConversations = async () => {
		const list = await sync(() => api.get<AiConversation[]>("/api/ai/conversations"));
		if (list) conversations = list;
	};

	const visibleHistoryActions = $derived(
		showUndone
			? historyActions
			: historyActions.filter((a) => a.status !== "undone" && a.status !== "undo_failed")
	);

	return {
		get enabled() {
			return enabled;
		},
		get activeConversationId() {
			return activeConversationId;
		},
		get conversations() {
			return conversations;
		},
		get messages() {
			return messages;
		},
		get pendingConfirmations() {
			return pendingConfirmations;
		},
		get pendingPolish() {
			return pendingPolish;
		},
		get railOpen() {
			return railOpen;
		},
		get historyActions() {
			return historyActions;
		},
		get visibleHistoryActions() {
			return visibleHistoryActions;
		},
		get showUndone() {
			return showUndone;
		},
		get streaming() {
			return streaming;
		},
		get inputBusy() {
			return inputBusy;
		},
		get error() {
			return error;
		},
		get anomalySettings() {
			return anomalySettings;
		},
		get mobileOpen() {
			return mobileOpen;
		},
		get desktopOpen() {
			return desktopOpen;
		},
		get inputFocusNonce() {
			return inputFocusNonce;
		},
		get pendingImages() {
			return pendingImages;
		},
		get maxPendingImages() {
			return MAX_PENDING_IMAGES;
		},
		addPendingImage,
		removePendingImage,
		clearPendingImages,
		hydrate,
		setEnabled,
		setMobileOpen,
		openDesktop,
		closeDesktop,
		toggleDesktop,
		requestInputFocus,
		toggleRail,
		closeRail,
		setShowUndone,
		setError,
		setStreaming,
		updateAnomalySettings,
		appendUserMessage,
		startAssistantMessage,
		appendAssistantDelta,
		finalizeAssistantMessage,
		attachToolCall,
		updateToolCall,
		enqueueConfirmation,
		dequeueConfirmation,
		enqueuePolish,
		dequeuePolish,
		setActiveConversation,
		upsertConversation,
		replaceConversations,
		removeConversation,
		replaceMessages,
		clearMessages,
		pushHistoryAction,
		replaceHistoryActions,
		markHistoryActionUndone,
		markHistoryActionUndoFailed,
		removeHistoryAction,
		reloadActions,
		reloadConversations
	};
};

export const ai = createAiStore();
