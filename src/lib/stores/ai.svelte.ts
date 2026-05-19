import { untrack } from "svelte";

export interface AiMessage {
	id: string;
	role: "user" | "assistant" | "tool" | "system";
	content: string;
	createdAt: string;
}

export interface AiConversation {
	id: string;
	title: string;
	updatedAt: string;
}

export interface AiHydrationPayload {
	activeConversation: AiConversation | null;
	messages: AiMessage[];
}

const createAiStore = () => {
	let activeConversationId = $state<string | null>(null);
	let conversations = $state<AiConversation[]>([]);
	let messages = $state<AiMessage[]>([]);
	let streamingMessage = $state<string>("");
	let inputDisabled = $state(false);
	let historyOpen = $state(false);

	return {
		get activeConversationId() {
			return activeConversationId;
		},
		get conversations() {
			return conversations;
		},
		get messages() {
			return messages;
		},
		get streamingMessage() {
			return streamingMessage;
		},
		get inputDisabled() {
			return inputDisabled;
		},
		get historyOpen() {
			return historyOpen;
		},
		hydrate(payload: AiHydrationPayload) {
			untrack(() => {
				activeConversationId = payload.activeConversation?.id ?? null;
				messages = payload.messages;
				conversations = payload.activeConversation ? [payload.activeConversation] : [];
			});
		},
		setHistoryOpen(open: boolean) {
			historyOpen = open;
		},
		setStreamingMessage(value: string) {
			streamingMessage = value;
		},
		setInputDisabled(disabled: boolean) {
			inputDisabled = disabled;
		}
	};
};

export const ai = createAiStore();
