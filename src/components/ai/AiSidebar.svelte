<script lang="ts">
	import { ai } from "$lib/stores/ai.svelte";
	import { createNewConversation, sendMessage } from "$lib/ai/chat-client";
	import AiHeader from "./AiHeader.svelte";
	import AiWelcome from "./AiWelcome.svelte";
	import AiMessageList from "./AiMessageList.svelte";
	import AiComposer from "./AiComposer.svelte";
	import AiConversationsPanel from "./AiConversationsPanel.svelte";
	import { cn } from "$lib/utils";

	let {
		bare = false,
		onClose
	}: {
		bare?: boolean;
		onClose?: () => void;
	} = $props();

	let composerRef = $state<{ setValue: (text: string) => void } | null>(null);

	const historyOpen = $derived(ai.railOpen);
	const hasMessages = $derived(ai.messages.length > 0);

	const status = $derived<"online" | "connecting" | "error">(
		ai.error ? "error" : ai.inputBusy && !ai.streaming ? "connecting" : "online"
	);

	const onSend = async (text: string) => {
		if (!text.trim() || ai.inputBusy) return;
		await sendMessage(text);
	};

	const onNewChat = async () => {
		await createNewConversation();
		ai.closeRail();
	};

	const onToggleHistory = () => {
		ai.toggleRail();
	};

	const onSuggestionClick = (text: string) => {
		composerRef?.setValue(text);
	};
</script>

<section
	class={cn(
		"bg-chat-bg flex h-full min-h-[30rem] flex-col overflow-hidden",
		!bare && "border-chat-border rounded-xl border shadow-[var(--chat-shadow)]"
	)}
	aria-label="AI Copilot"
>
	<AiHeader
		{onClose}
		onNewConversation={onNewChat}
		{onToggleHistory}
		{hasMessages}
		{historyOpen}
		{status}
		showCloseButton={bare && !!onClose}
	/>

	{#if historyOpen}
		<div class="border-chat-border-subtle flex-1 overflow-hidden border-b">
			<AiConversationsPanel />
		</div>
	{:else if !hasMessages}
		<div class="chat-message-enter flex min-h-0 flex-1 overflow-y-auto">
			<AiWelcome {onSuggestionClick} />
		</div>
	{:else}
		<AiMessageList messages={ai.messages} isStreaming={ai.inputBusy} />
	{/if}

	{#if !historyOpen}
		{#if ai.error}
			<div role="alert" class="px-4 py-2 text-center text-xs text-pretty text-red-400/80">
				{ai.error}
			</div>
		{/if}

		<AiComposer bind:this={composerRef} {onSend} disabled={ai.inputBusy} />
	{/if}
</section>
