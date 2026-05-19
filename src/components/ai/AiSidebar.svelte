<script lang="ts">
	import { ai } from "$lib/stores/ai.svelte";
	import { sendMessage } from "$lib/ai/chat-client";
	import AiMessage from "./AiMessage.svelte";
	import AiHistoryPanel from "./AiHistoryPanel.svelte";
	import AiConversationsMenu from "./AiConversationsMenu.svelte";
	import { Loader2, Send, Sparkles } from "@lucide/svelte";
	import { tick } from "svelte";
	import { cn } from "$lib/utils";

	let input = $state("");
	let scrollContainer: HTMLDivElement | null = $state(null);
	let textarea: HTMLTextAreaElement | null = $state(null);

	const examples = [
		"Add this month's invoices for my active clients",
		"Polish the first client's service description",
		"Mark the most recent invoice inactive"
	];

	const onSubmit = async (overrideMessage?: string) => {
		const trimmed = (overrideMessage ?? input).trim();
		if (!trimmed || ai.inputBusy) return;
		input = "";
		await sendMessage(trimmed);
		await tick();
		scrollToBottom();
	};

	const onKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			void onSubmit();
		}
	};

	const scrollToBottom = () => {
		if (!scrollContainer) return;
		scrollContainer.scrollTop = scrollContainer.scrollHeight;
	};

	$effect(() => {
		if (ai.messages.length > 0) {
			tick().then(scrollToBottom);
		}
	});
</script>

<section
	class="border-border/60 bg-card/30 flex h-[calc(100vh-12rem)] min-h-[28rem] flex-col rounded-lg border lg:h-[calc(100vh-9rem)]"
	aria-label="AI Copilot"
>
	<header class="border-border/40 flex items-center justify-between gap-2 border-b px-3 py-2">
		<AiConversationsMenu />
	</header>

	<div class="border-border/40 border-b p-2">
		<AiHistoryPanel />
	</div>

	<div bind:this={scrollContainer} class="flex-1 space-y-3 overflow-y-auto px-3 py-3">
		{#if ai.messages.length === 0}
			<div class="text-muted-foreground py-6 text-center text-xs">
				<Sparkles class="text-muted-foreground/70 mx-auto mb-2 size-5" aria-hidden="true" />
				<p class="text-foreground/80 mb-1 text-sm">Type what you want. The invoices follow.</p>
				<p class="text-muted-foreground/80 mb-3 text-xs">Try one of these:</p>
				<div class="flex flex-col gap-1.5">
					{#each examples as ex (ex)}
						<button
							type="button"
							onclick={() => onSubmit(ex)}
							class="border-border/50 bg-background/40 hover:bg-accent/40 mx-auto block w-full max-w-xs rounded-md border px-3 py-1.5 text-left text-xs transition-colors"
						>
							{ex}
						</button>
					{/each}
				</div>
			</div>
		{:else}
			{#each ai.messages as msg (msg.id)}
				<AiMessage message={msg} />
			{/each}
		{/if}

		{#if ai.error}
			<div class="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-xs">
				{ai.error}
			</div>
		{/if}
	</div>

	<form
		class="border-border/40 border-t p-2"
		onsubmit={e => {
			e.preventDefault();
			void onSubmit();
		}}
	>
		<div
			class="border-border/50 bg-background/40 focus-within:border-border flex items-end gap-1.5 rounded-md border p-1.5 transition-colors"
		>
			<textarea
				bind:this={textarea}
				bind:value={input}
				onkeydown={onKeyDown}
				placeholder="Type a request…"
				rows="1"
				disabled={ai.inputBusy}
				class="text-foreground placeholder:text-muted-foreground/70 max-h-32 min-h-6 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none disabled:opacity-60"
				aria-label="Type a request"
			></textarea>
			<button
				type="submit"
				disabled={ai.inputBusy || input.trim().length === 0}
				class={cn(
					"inline-flex shrink-0 items-center justify-center rounded-md transition-colors",
					"size-7",
					ai.inputBusy || input.trim().length === 0
						? "bg-muted/40 text-muted-foreground"
						: "bg-foreground text-background hover:bg-foreground/90"
				)}
				aria-label="Send"
			>
				{#if ai.inputBusy}
					<Loader2 class="size-3.5 animate-spin" aria-hidden="true" />
				{:else}
					<Send class="size-3.5" aria-hidden="true" />
				{/if}
			</button>
		</div>
	</form>
</section>
