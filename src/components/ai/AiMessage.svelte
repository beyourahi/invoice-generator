<script lang="ts">
	import type { AiMessage } from "$lib/stores/ai.svelte";
	import type { MdBlock, MdInline } from "$lib/ai/markdown";
	import { parseMarkdown } from "$lib/ai/markdown";
	import AiToolBadge from "./AiToolBadge.svelte";
	import { cn } from "$lib/utils";
	import { Sparkles } from "@lucide/svelte";

	let { message }: { message: AiMessage } = $props();

	const isUser = $derived(message.role === "user");
	const blocks = $derived<MdBlock[]>(isUser ? [] : parseMarkdown(message.content));
	const waveBars = [0, 1, 2, 3, 4];

	const timeLabel = $derived.by(() => {
		const parsed = Date.parse(message.createdAt);
		if (Number.isNaN(parsed)) return "";
		const seconds = Math.round((Date.now() - parsed) / 1000);
		if (seconds < 45) return "just now";
		const minutes = Math.round(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.round(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.round(hours / 24)}d ago`;
	});
</script>

{#snippet inline(nodes: MdInline[])}
	{#each nodes as node, i (i)}
		{#if node.type === "text"}{node.value}{:else if node.type === "bold"}<strong
				class="text-foreground font-semibold">{node.value}</strong
			>{:else if node.type === "italic"}<em class="italic">{node.value}</em
			>{:else if node.type === "code"}<code
				class="bg-muted/80 text-foreground rounded px-1 py-0.5 font-mono text-[0.85em]">{node.value}</code
			>{:else if node.type === "link"}<a
				href={node.href}
				target="_blank"
				rel="noopener noreferrer"
				class="text-foreground decoration-foreground/35 hover:decoration-foreground font-medium underline underline-offset-2 transition-colors"
				>{node.label}</a
			>{/if}
	{/each}
{/snippet}

<div class={cn("flex items-start gap-2.5", isUser ? "ai-enter-right justify-end" : "ai-enter justify-start")}>
	{#if !isUser}
		<div
			class="from-muted to-muted/30 border-border/60 text-foreground/75 flex size-7 shrink-0 items-center justify-center rounded-lg border bg-gradient-to-br"
		>
			<Sparkles class="size-3.5" aria-hidden="true" />
		</div>
	{/if}

	<div class={cn("flex max-w-[88%] min-w-0 flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
		{#if isUser}
			<div
				class="bg-foreground text-background rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm leading-relaxed shadow-sm"
			>
				<span class="break-words whitespace-pre-wrap">{message.content}</span>
			</div>
		{:else if message.content}
			<div
				class="bg-card border-border/70 text-card-foreground rounded-2xl rounded-bl-md border px-3.5 py-2.5 text-sm"
			>
				<div class="ai-prose space-y-2.5 leading-relaxed">
					{#each blocks as block, bi (bi)}
						{#if block.type === "paragraph"}
							<p class="text-pretty">
								{#each block.lines as line, li (li)}
									{#if li > 0}<br />{/if}{@render inline(line)}
								{/each}
							</p>
						{:else if block.type === "heading"}
							<p class="text-foreground text-[0.9rem] font-semibold text-balance">
								{@render inline(block.nodes)}
							</p>
						{:else if block.type === "list"}
							<ul class="space-y-1">
								{#each block.items as item, ii (ii)}
									<li class="flex gap-2">
										<span class="text-muted-foreground shrink-0 tabular-nums select-none">
											{block.ordered ? `${ii + 1}.` : "•"}
										</span>
										<span class="min-w-0 text-pretty">{@render inline(item)}</span>
									</li>
								{/each}
							</ul>
						{:else if block.type === "codeblock"}
							<pre
								class="ai-scroll border-border/70 bg-background/70 overflow-x-auto rounded-lg border p-2.5"><code
									class="text-foreground/90 font-mono text-[11px] leading-relaxed">{block.value}</code
								></pre>
						{/if}
					{/each}
				</div>
			</div>
		{:else if message.streaming}
			<div
				class="bg-card border-border/70 rounded-2xl rounded-bl-md border px-3.5 py-3"
				role="status"
				aria-label="Generating response"
			>
				<div class="flex h-4 items-end gap-[3px]">
					{#each waveBars as bar (bar)}
						<span
							class="ai-wave-bar bg-foreground/45 h-4 w-[3px] rounded-full"
							style="animation-delay: {bar * 0.12}s"
						></span>
					{/each}
				</div>
				<span class="sr-only">Generating response…</span>
			</div>
		{/if}

		{#if message.toolCalls.length > 0}
			<div class="flex w-full flex-col gap-1.5">
				{#each message.toolCalls as call (call.id)}
					<AiToolBadge {call} />
				{/each}
			</div>
		{/if}

		{#if message.content && timeLabel}
			<span class="text-muted-foreground/55 px-1 text-[10px] tabular-nums">{timeLabel}</span>
		{/if}
	</div>
</div>
