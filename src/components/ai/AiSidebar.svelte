<script lang="ts">
	import { ai } from "$lib/stores/ai.svelte";
	import { sendMessage } from "$lib/ai/chat-client";
	import AiMessage from "./AiMessage.svelte";
	import AiHistoryPanel from "./AiHistoryPanel.svelte";
	import AiConversationsPanel from "./AiConversationsPanel.svelte";
	import {
		ArrowRight,
		ArrowUp,
		CalendarPlus,
		EyeOff,
		History,
		MessagesSquare,
		Sparkles,
		Wand2
	} from "@lucide/svelte";
	import { tick } from "svelte";
	import { cn } from "$lib/utils";

	let input = $state("");
	let scrollContainer: HTMLDivElement | null = $state(null);
	let textarea: HTMLTextAreaElement | null = $state(null);

	const examples = [
		{ icon: CalendarPlus, text: "Add this month's invoices for my active clients" },
		{ icon: Wand2, text: "Polish the first client's service description" },
		{ icon: EyeOff, text: "Mark the most recent invoice inactive" }
	];

	const markBars = [0, 1, 2, 3];
	const dots = [0, 1, 2];

	const status = $derived.by(() => {
		if (ai.error) return { tone: "error", label: "Error" } as const;
		if (ai.streaming) return { tone: "thinking", label: "Thinking…" } as const;
		return { tone: "ready", label: "Ready" } as const;
	});

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
</script>

<section
	class="border-border/60 bg-card/30 flex h-full min-h-[28rem] flex-col overflow-hidden rounded-xl border shadow-sm lg:h-[calc(100vh-9rem)]"
	aria-label="AI Copilot"
>
	<header class="border-border/40 flex items-center justify-between gap-2 border-b px-3 py-2.5">
		<div class="flex min-w-0 items-center gap-2">
			<div class="bg-foreground text-background flex size-6 shrink-0 items-center justify-center rounded-md">
				<Sparkles class="size-3.5" aria-hidden="true" />
			</div>
			<span class="text-foreground truncate text-xs font-semibold">AI Copilot</span>
		</div>
		<div class="flex shrink-0 items-center gap-1.5" aria-label="Status: {status.label}">
			<span
				class={cn(
					"size-1.5 rounded-full",
					status.tone === "ready" && "bg-status-active",
					status.tone === "thinking" && "status-dot-pulse bg-amber-400",
					status.tone === "error" && "bg-destructive"
				)}
			></span>
			<span class="text-muted-foreground/80 text-[10px] font-medium tracking-wide">
				{status.label}
			</span>
		</div>
	</header>

	<div class="border-border/40 border-b p-2">
		<div class="bg-card/60 border-border/60 grid grid-cols-2 gap-1 rounded-lg border p-1">
			{#each railTabs as tab (tab.id)}
				{@const isActive = ai.railTab === tab.id}
				<button
					type="button"
					onclick={() => ai.toggleRailTab(tab.id)}
					aria-expanded={isActive}
					class={cn(
						"flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-all",
						isActive
							? "bg-foreground text-background font-semibold shadow-sm shadow-black/20"
							: "text-muted-foreground pointer-fine:hover:text-foreground pointer-fine:hover:bg-accent/40 font-medium"
					)}
				>
					<tab.icon class="size-3.5 shrink-0" aria-hidden="true" />
					<span>{tab.label}</span>
					<span
						class={cn(
							"rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums",
							isActive ? "bg-background/25 text-background" : "bg-muted/70 text-muted-foreground"
						)}
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
		class="ai-scroll flex-1 space-y-4 overflow-y-auto px-3.5 py-4"
		aria-live="polite"
		aria-relevant="additions"
	>
		{#if ai.messages.length === 0}
			<div class="flex h-full flex-col items-center justify-center px-4 py-6 text-center">
				<div class="ai-rise mb-4 flex h-7 items-end gap-1" style="animation-delay: 0ms">
					{#each markBars as bar (bar)}
						<span
							class="ai-mark-bar bg-foreground h-7 w-[3.5px] rounded-full"
							style="animation-delay: {bar * 0.13}s"
						></span>
					{/each}
				</div>
				<p
					class="text-foreground ai-rise mb-1.5 text-sm font-semibold text-balance"
					style="animation-delay: 90ms"
				>
					Type what you want. The invoices follow.
				</p>
				<p
					class="text-muted-foreground ai-rise mb-5 max-w-[17rem] text-xs leading-relaxed text-pretty"
					style="animation-delay: 150ms"
				>
					Describe an edit in plain words — the copilot updates the right clients and invoices for you.
				</p>
				<div class="flex w-full max-w-xs flex-col gap-2">
					{#each examples as example, i (example.text)}
						<button
							type="button"
							onclick={() => onSubmit(example.text)}
							class="ai-rise group border-border/60 bg-background/50 pointer-fine:hover:border-foreground/25 pointer-fine:hover:bg-accent/50 flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors"
							style="animation-delay: {220 + i * 80}ms"
						>
							<span
								class="bg-muted/60 text-muted-foreground group-hover:text-foreground flex size-7 shrink-0 items-center justify-center rounded-md transition-colors"
							>
								<example.icon class="size-3.5" aria-hidden="true" />
							</span>
							<span class="text-foreground/85 min-w-0 flex-1 text-xs leading-snug text-pretty">
								{example.text}
							</span>
							<ArrowRight
								class="text-muted-foreground size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
								aria-hidden="true"
							/>
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
			<div
				class="ai-enter border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-xs text-pretty"
				role="alert"
			>
				{ai.error}
			</div>
		{/if}
	</div>

	<form
		class="border-border/40 border-t p-2.5"
		onsubmit={e => {
			e.preventDefault();
			void onSubmit();
		}}
	>
		<div
			class="border-border/60 bg-background/60 focus-within:border-foreground/30 focus-within:ring-foreground/10 flex items-end gap-1.5 rounded-xl border p-1.5 transition-all focus-within:ring-2"
		>
			<textarea
				bind:this={textarea}
				bind:value={input}
				oninput={autoGrow}
				onkeydown={onKeyDown}
				placeholder="Ask the copilot to change something…"
				rows="1"
				disabled={ai.inputBusy}
				class="text-foreground placeholder:text-muted-foreground/60 ai-scroll max-h-32 min-h-[2rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed outline-none disabled:opacity-60"
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
						? "bg-muted/50 text-muted-foreground"
						: "bg-foreground text-background pointer-fine:hover:bg-foreground/90 active:scale-95"
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
		<div class="text-muted-foreground/55 mt-1.5 hidden items-center gap-1 px-1 text-[10px] sm:flex">
			<kbd class="border-border/60 bg-muted/50 rounded border px-1 py-px font-sans">Enter</kbd>
			<span>to send</span>
			<span class="text-muted-foreground/30">·</span>
			<kbd class="border-border/60 bg-muted/50 rounded border px-1 py-px font-sans">Shift</kbd>
			<span>+</span>
			<kbd class="border-border/60 bg-muted/50 rounded border px-1 py-px font-sans">Enter</kbd>
			<span>for a new line</span>
		</div>
	</form>
</section>
