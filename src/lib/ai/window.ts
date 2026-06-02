export interface HistoryMessage {
	role: "user" | "assistant" | "system";
	content: string;
}

export const WINDOW_SIZE = 12;

export const windowHistory = (
	messages: HistoryMessage[],
	windowSize = WINDOW_SIZE
): HistoryMessage[] => {
	if (messages.length <= windowSize) return messages;
	return messages.slice(-windowSize);
};
