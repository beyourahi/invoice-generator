<script lang="ts">
	import type { AiMessage } from "$lib/stores/ai.svelte";
	import AiToolBadge from "./AiToolBadge.svelte";
	import { cn } from "$lib/utils";
	import { Sparkles, User2 } from "@lucide/svelte";

	let { message }: { message: AiMessage } = $props();

	const isUser = $derived(message.role === "user");
</script>

<div class={cn("flex gap-2.5", isUser ? "justify-end" : "justify-start")}>
	{#if !isUser}
		<div class="bg-muted/40 text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full">
			<Sparkles class="size-3.5" aria-hidden="true" />
		</div>
	{/if}

	<div class={cn("flex max-w-[85%] flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
		<div
			class={cn(
				"rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
				isUser ? "bg-foreground text-background" : "bg-card border-border/60 text-card-foreground border"
			)}
			aria-live={message.streaming ? "polite" : undefined}
		>
			{#if message.content}
				<span class="break-words whitespace-pre-wrap">{message.content}</span>
			{:else if message.streaming}
				<span class="text-muted-foreground inline-block animate-pulse">…</span>
			{/if}
		</div>

		{#if message.toolCalls.length > 0}
			<div class="flex w-full flex-col gap-1.5">
				{#each message.toolCalls as call (call.id)}
					<AiToolBadge {call} />
				{/each}
			</div>
		{/if}
	</div>

	{#if isUser}
		<div class="bg-muted/40 text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full">
			<User2 class="size-3.5" aria-hidden="true" />
		</div>
	{/if}
</div>
