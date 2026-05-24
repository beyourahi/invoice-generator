<script lang="ts">
	import { X, Plus, Clock } from "@lucide/svelte";

	let {
		onClose,
		onNewConversation,
		onToggleHistory,
		hasMessages,
		historyOpen,
		status = "online",
		showCloseButton = false
	}: {
		onClose?: () => void;
		onNewConversation: () => void;
		onToggleHistory: () => void;
		hasMessages: boolean;
		historyOpen: boolean;
		status?: "online" | "connecting" | "error";
		showCloseButton?: boolean;
	} = $props();

	const statusConfig = $derived(
		{
			online: { dot: "bg-emerald-400", label: "online" },
			connecting: { dot: "bg-amber-400 animate-pulse", label: "connecting" },
			error: { dot: "bg-red-400", label: "offline" }
		}[status]
	);
</script>

<div class="border-chat-border flex items-center justify-between border-b px-4 py-3 md:px-5 md:py-4">
	<div class="flex items-center gap-3">
		<div class="h-2 w-2 rounded-full {statusConfig.dot}"></div>
		<span class="text-chat-text-muted text-xs whitespace-nowrap">{statusConfig.label}</span>
	</div>
	<div class="flex items-center gap-1">
		{#if !historyOpen}
			<button
				type="button"
				onclick={onToggleHistory}
				class="hover:bg-chat-surface-hover rounded-xl p-2.5 transition-colors md:p-2"
				aria-label="Chat history"
			>
				<Clock class="text-chat-icon-muted h-5 w-5 md:h-4 md:w-4" />
			</button>
		{/if}
		{#if hasMessages}
			<button
				type="button"
				onclick={onNewConversation}
				class="hover:bg-chat-surface-hover rounded-xl p-2.5 transition-colors md:p-2"
				aria-label="New conversation"
			>
				<Plus class="text-chat-icon-muted h-5 w-5 md:h-4 md:w-4" />
			</button>
		{/if}
		{#if showCloseButton && onClose}
			<button
				type="button"
				onclick={onClose}
				class="hover:bg-chat-surface-hover rounded-xl p-2.5 transition-colors md:p-2"
				aria-label="Close chat"
			>
				<X class="text-chat-icon-muted h-5 w-5 md:h-4 md:w-4" />
			</button>
		{/if}
	</div>
</div>
