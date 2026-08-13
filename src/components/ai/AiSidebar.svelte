<!--
	Composes the Copilot chat shell (header + body + composer). Body switches between history,
	the welcome empty-state, and the message list. `bare` drops the bordered card chrome for the
	mobile sheet. Status dot derives from store error/busy/streaming flags.
-->
<script lang="ts">
	import { ai } from "$lib/stores/ai.svelte";
	import { createNewConversation, sendMessage } from "$lib/ai/chat-client";
	import AiHeader from "./AiHeader.svelte";
	import AiWelcome from "./AiWelcome.svelte";
	import AiMessageList from "./AiMessageList.svelte";
	import AiComposer from "./AiComposer.svelte";
	import AiConversationsPanel from "./AiConversationsPanel.svelte";
	import { cn } from "$lib/utils";
	import { ArrowUpRight } from "@lucide/svelte";

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
		if ((!text.trim() && ai.pendingImages.length === 0) || ai.inputBusy) return;
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
		!bare && "border-chat-border rounded-2xl border border-solid shadow-[var(--chat-shadow)]"
	)}
	aria-label="AI chat"
>
	<AiHeader
		{onClose}
		onNewConversation={onNewChat}
		{onToggleHistory}
		{hasMessages}
		{historyOpen}
		historyCount={ai.conversations.length}
		{status}
		showCloseButton={!!onClose}
	/>

	{#if historyOpen}
		<div class="border-chat-border-subtle border-b border-solid px-3 py-3 md:px-4">
			<AiConversationsPanel />
		</div>
	{/if}

	{#if !hasMessages}
		<div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
			<AiWelcome {onSuggestionClick} />
		</div>
	{:else}
		<AiMessageList messages={ai.messages} isStreaming={ai.inputBusy} />
	{/if}

	{#if ai.connectRequired}
		<!-- 412 gate: the Copilot runs on the user's own Cloudflare account, which isn't
			connected yet. Direct them to Settings instead of showing a raw error. -->
		<div role="alert" class="border-chat-border-subtle border-t border-solid px-4 py-3">
			<p class="text-chat-text-muted text-xs text-pretty">
				The Copilot runs on your own Cloudflare account. Connect one to start chatting.
			</p>
			<a
				href="/settings"
				class="bg-signal text-background hover:bg-signal/90 focus-visible:outline-signal text-caption mt-2.5 inline-flex touch-manipulation items-center gap-1.5 rounded-full px-4 py-2 tracking-[0.06em] whitespace-nowrap uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
			>
				Connect in Settings
				<ArrowUpRight class="size-3.5" strokeWidth={2.25} aria-hidden="true" />
			</a>
		</div>
	{:else if ai.error}
		<div role="alert" class="text-destructive px-4 py-2 text-center text-xs text-pretty">
			{ai.error}
		</div>
	{/if}

	<AiComposer bind:this={composerRef} {onSend} disabled={ai.inputBusy} />
</section>
