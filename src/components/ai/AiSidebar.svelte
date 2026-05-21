<script lang="ts">
	import { ai } from "$lib/stores/ai.svelte";
	import { createNewConversation, sendMessage } from "$lib/ai/chat-client";
	import AiMessage from "./AiMessage.svelte";
	import AiConversationsPanel from "./AiConversationsPanel.svelte";
	import AiLauncherIcon from "./AiLauncherIcon.svelte";
	import { ArrowUp, CalendarPlus, EyeOff, History, MessageSquarePlus, Wand2 } from "@lucide/svelte";
	import { tick } from "svelte";
	import { cn } from "$lib/utils";

	let { bare = false }: { bare?: boolean } = $props();

	let input = $state("");
	let scrollContainer: HTMLDivElement | null = $state(null);
	let textarea: HTMLTextAreaElement | null = $state(null);

	const examples = [
		{ icon: CalendarPlus, text: "Add this month's invoices for my active clients" },
		{ icon: Wand2, text: "Polish the first client's service description" },
		{ icon: EyeOff, text: "Mark the most recent invoice inactive" }
	];

	const dots = [0, 1, 2];

	const lastContent = $derived(ai.messages.at(-1)?.content ?? "");

	const autoGrow = () => {
		if (!textarea) return;
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
	};

	const scrollToBottom = () => {
		if (!scrollContainer) return;
		scrollContainer.scrollTop = scrollContainer.scrollHeight;
	};

	const onSubmit = async (overrideMessage?: string) => {
		const trimmed = (overrideMessage ?? input).trim();
		if (!trimmed || ai.inputBusy) return;
		input = "";
		if (textarea) textarea.style.height = "auto";
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

	const onNewChat = async () => {
		await createNewConversation();
		ai.closeRail();
	};

	$effect(() => {
		void ai.messages.length;
		void lastContent;
		tick().then(scrollToBottom);
	});

	$effect(() => {
		if (ai.inputFocusNonce === 0) return;
		tick().then(() => textarea?.focus());
	});
</script>

<section
	class={cn(
		"bg-background flex h-full min-h-[30rem] flex-col overflow-hidden",
		!bare && "border-border-strong/60 rounded-xl border border-solid shadow-2xl"
	)}
	aria-label="AI Copilot"
>
	<div class="border-border-strong/40 border-b border-solid p-2">
		<div class={cn("flex items-center gap-2", bare && "mr-12")}>
			<button
				type="button"
				onclick={onNewChat}
				class="bg-card border-border-strong/50 text-muted-foreground hover:text-foreground hover:bg-muted flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-solid px-3 py-2 text-xs transition-colors"
			>
				<MessageSquarePlus class="size-3.5 shrink-0" aria-hidden="true" />
				<span>New chat</span>
			</button>
			<button
				type="button"
				onclick={ai.toggleRail}
				aria-expanded={ai.railOpen}
				class={cn(
					"bg-card border-border-strong/50 flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-solid px-3 py-2 text-xs transition-colors",
					ai.railOpen
						? "bg-primary/10 text-foreground font-medium"
						: "text-muted-foreground hover:text-foreground hover:bg-muted"
				)}
			>
				<History class="size-3.5 shrink-0" aria-hidden="true" />
				<span>History</span>
				<span
					class="bg-background text-muted-foreground rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums"
				>
					{ai.conversations.length}
				</span>
			</button>
		</div>

		{#if ai.railOpen}
			<div class="ai-enter mt-2">
				<AiConversationsPanel />
			</div>
		{/if}
	</div>

	<div
		bind:this={scrollContainer}
		class="ai-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4"
		aria-live="polite"
		aria-relevant="additions"
	>
		{#if ai.messages.length === 0}
			<div class="flex h-full flex-col items-center justify-center px-4 py-6 text-center">
				<AiLauncherIcon variant="row" class="ai-rise mb-5" />
				<p
					class="text-foreground ai-rise mb-1.5 text-lg font-medium text-balance"
					style="animation-delay: 100ms"
				>
					Type what you want. The invoices follow.
				</p>
				<p
					class="text-muted-foreground ai-rise mb-5 max-w-md text-xs leading-relaxed text-pretty md:text-sm"
					style="animation-delay: 200ms"
				>
					Describe an edit in plain words — the copilot updates the right clients and invoices for you.
				</p>
				<div class="flex w-full max-w-xs flex-col gap-2">
					{#each examples as example, i (example.text)}
						<button
							type="button"
							onclick={() => onSubmit(example.text)}
							class="ai-rise group border-border-strong/40 bg-card hover:border-border-strong/70 hover:bg-muted flex w-full items-center gap-3 rounded-xl border border-solid px-3.5 py-2.5 text-left transition-colors"
							style="animation-delay: {300 + i * 80}ms"
						>
							<span
								class="bg-primary/5 text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
							>
								<example.icon class="size-3.5" aria-hidden="true" />
							</span>
							<span class="text-muted-foreground min-w-0 flex-1 text-xs leading-snug text-pretty">
								{example.text}
							</span>
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<svelte:boundary>
				{#each ai.messages as msg (msg.id)}
					<AiMessage message={msg} />
				{/each}
				{#snippet failed(_error, reset)}
					<div class="ai-enter flex flex-col items-center gap-2 py-6 text-center" role="alert">
						<p class="text-destructive text-sm font-medium">The Copilot hit a display error.</p>
						<p class="text-muted-foreground max-w-xs text-xs text-pretty">
							Something went wrong showing this conversation. Retry to reload it.
						</p>
						<button
							type="button"
							onclick={reset}
							class="border-border-strong/50 bg-card text-foreground hover:bg-muted mt-1 rounded-lg border border-solid px-3 py-1.5 text-xs font-medium transition-colors"
						>
							Retry
						</button>
					</div>
				{/snippet}
			</svelte:boundary>
		{/if}

		{#if ai.error}
			<p class="ai-enter text-destructive text-center text-xs text-pretty" role="alert">
				{ai.error}
			</p>
		{/if}
	</div>

	<form
		class="border-border-strong/40 border-t border-solid p-2.5"
		onsubmit={e => {
			e.preventDefault();
			void onSubmit();
		}}
	>
		<div
			class="border-border-strong/50 bg-card focus-within:border-border-strong flex flex-col gap-1.5 rounded-2xl border border-solid p-1.5 transition-colors"
		>
			<div class="flex items-end gap-1.5">
				<textarea
					bind:this={textarea}
					bind:value={input}
					oninput={autoGrow}
					onkeydown={onKeyDown}
					placeholder="Ask the Copilot to change something…"
					rows="1"
					disabled={ai.inputBusy}
					class="text-foreground placeholder:text-muted-foreground ai-scroll max-h-32 min-h-[2rem] flex-1 resize-none bg-transparent px-1 py-1.5 text-sm leading-relaxed outline-none disabled:opacity-60"
					aria-label="Type a request"
				></textarea>
				<button
					type="submit"
					disabled={ai.inputBusy || input.trim().length === 0}
					class={cn(
						"inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-all disabled:cursor-not-allowed",
						ai.inputBusy && "cursor-wait",
						ai.inputBusy || input.trim().length === 0
							? "text-muted-foreground"
							: "bg-primary/10 text-foreground hover:bg-muted active:scale-95"
					)}
					aria-label="Send"
				>
					{#if ai.inputBusy}
						<span class="flex items-center gap-[3px]" aria-hidden="true">
							{#each dots as dot (dot)}
								<span
									class="ai-dot size-1 rounded-full bg-current"
									style="animation-delay: {dot * 0.15}s"
								></span>
							{/each}
						</span>
					{:else}
						<ArrowUp class="size-4" aria-hidden="true" />
					{/if}
				</button>
			</div>
		</div>
		<div class="text-muted-foreground mt-1.5 hidden items-center gap-1 px-1 text-[10px] sm:flex">
			<kbd class="border-border-strong/50 bg-card rounded border border-solid px-1 py-px font-sans">Enter</kbd>
			<span>to send</span>
			<span class="text-muted-foreground/40">·</span>
			<kbd class="border-border-strong/50 bg-card rounded border border-solid px-1 py-px font-sans">Shift</kbd>
			<span>+</span>
			<kbd class="border-border-strong/50 bg-card rounded border border-solid px-1 py-px font-sans">Enter</kbd>
			<span>for a new line</span>
		</div>
	</form>
</section>
