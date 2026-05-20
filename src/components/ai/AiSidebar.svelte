<script lang="ts">
	import { ai } from "$lib/stores/ai.svelte";
	import { sendMessage } from "$lib/ai/chat-client";
	import AiMessage from "./AiMessage.svelte";
	import AiHistoryPanel from "./AiHistoryPanel.svelte";
	import AiConversationsPanel from "./AiConversationsPanel.svelte";
	import { ArrowUp, CalendarPlus, EyeOff, History, MessagesSquare, Wand2 } from "@lucide/svelte";
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

	const railTabs = $derived([
		{
			id: "conversations" as const,
			label: "Conversations",
			icon: MessagesSquare,
			count: ai.conversations.length
		},
		{ id: "history" as const, label: "History", icon: History, count: ai.historyActions.length }
	]);

	const autoGrow = () => {
		if (!textarea) return;
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
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

	const scrollToBottom = () => {
		if (!scrollContainer) return;
		scrollContainer.scrollTop = scrollContainer.scrollHeight;
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
		"bg-background flex h-full min-h-[28rem] flex-col overflow-hidden lg:h-[calc(100vh-9rem)]",
		!bare && "border-border rounded-xl border shadow-2xl"
	)}
	aria-label="AI Copilot"
>
	<div class="border-border border-b p-2">
		<div class={cn("bg-card border-border grid grid-cols-2 gap-1 rounded-lg border p-1", bare && "mr-12")}>
			{#each railTabs as tab (tab.id)}
				{@const isActive = ai.railTab === tab.id}
				<button
					type="button"
					onclick={() => ai.toggleRailTab(tab.id)}
					aria-expanded={isActive}
					class={cn(
						"flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors",
						isActive
							? "bg-primary/10 text-foreground font-medium"
							: "text-muted-foreground pointer-fine:hover:text-foreground pointer-fine:hover:bg-muted"
					)}
				>
					<tab.icon class="size-3.5 shrink-0" aria-hidden="true" />
					<span>{tab.label}</span>
					<span
						class="bg-background text-muted-foreground rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums"
					>
						{tab.count}
					</span>
				</button>
			{/each}
		</div>

		{#if ai.railTab}
			<div class="ai-enter mt-2">
				{#if ai.railTab === "conversations"}
					<AiConversationsPanel />
				{:else}
					<AiHistoryPanel />
				{/if}
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
				<div
					class="launcher-icon-row launcher-idle-row ai-rise mb-5"
					style="animation-delay: 0ms"
					aria-hidden="true"
				>
					<div></div>
					<div></div>
					<div></div>
					<div></div>
				</div>
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
							class="ai-rise group border-border/50 bg-card pointer-fine:hover:border-border pointer-fine:hover:bg-muted flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors"
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

				{#snippet failed(error, reset)}
					<div class="ai-enter flex flex-col items-center gap-2 py-6 text-center" role="alert">
						<p class="text-sm font-medium text-red-400/90">The copilot hit a display error.</p>
						<p class="text-muted-foreground max-w-xs text-xs text-pretty">
							{error instanceof Error
								? error.message
								: "Something went wrong rendering this conversation."}
						</p>
						<button
							type="button"
							onclick={reset}
							class="border-border bg-card text-foreground pointer-fine:hover:bg-muted mt-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
						>
							Retry
						</button>
					</div>
				{/snippet}
			</svelte:boundary>
		{/if}

		{#if ai.error}
			<p class="ai-enter text-center text-xs text-pretty text-red-400/80" role="alert">
				{ai.error}
			</p>
		{/if}
	</div>

	<form
		class="border-border border-t p-2.5"
		onsubmit={e => {
			e.preventDefault();
			void onSubmit();
		}}
	>
		<div
			class="border-border bg-card focus-within:border-muted-foreground flex items-end gap-1.5 rounded-2xl border p-1.5 transition-colors"
		>
			<textarea
				bind:this={textarea}
				bind:value={input}
				oninput={autoGrow}
				onkeydown={onKeyDown}
				placeholder="Ask the copilot to change something…"
				rows="1"
				disabled={ai.inputBusy}
				class="text-foreground placeholder:text-muted-foreground ai-scroll max-h-32 min-h-[2rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed outline-none disabled:opacity-60"
				aria-label="Type a request"
			></textarea>
			<button
				type="submit"
				disabled={ai.inputBusy || input.trim().length === 0}
				class={cn(
					"inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-all",
					"disabled:cursor-not-allowed",
					ai.inputBusy && "cursor-wait",
					ai.inputBusy || input.trim().length === 0
						? "text-muted-foreground"
						: "bg-primary/10 text-foreground pointer-fine:hover:bg-muted active:scale-95"
				)}
				aria-label="Send"
			>
				{#if ai.inputBusy}
					<span class="flex items-center gap-[3px]" aria-hidden="true">
						{#each dots as dot (dot)}
							<span class="ai-dot size-1 rounded-full bg-current" style="animation-delay: {dot * 0.15}s"
							></span>
						{/each}
					</span>
				{:else}
					<ArrowUp class="size-4" aria-hidden="true" />
				{/if}
			</button>
		</div>
		<div class="text-muted-foreground mt-1.5 hidden items-center gap-1 px-1 text-[10px] sm:flex">
			<kbd class="border-border bg-card rounded border px-1 py-px font-sans">Enter</kbd>
			<span>to send</span>
			<span class="text-muted-foreground/40">·</span>
			<kbd class="border-border bg-card rounded border px-1 py-px font-sans">Shift</kbd>
			<span>+</span>
			<kbd class="border-border bg-card rounded border px-1 py-px font-sans">Enter</kbd>
			<span>for a new line</span>
		</div>
	</form>
</section>
