<script lang="ts">
	import type { AiMessage } from "$lib/stores/ai.svelte";
	import type { MdBlock, MdInline } from "$lib/ai/markdown";
	import { parseMarkdown, sanitizeAssistantText } from "$lib/ai/markdown";
	import AiToolBadge from "./AiToolBadge.svelte";
	import { cn } from "$lib/utils";

	let { message }: { message: AiMessage } = $props();

	const isUser = $derived(message.role === "user");
	const blocks = $derived<MdBlock[]>(isUser ? [] : parseMarkdown(sanitizeAssistantText(message.content)));
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
			>{:else if node.type === "code"}{node.value}{:else if node.type === "link"}<a
				href={node.href}
				target="_blank"
				rel="noopener noreferrer"
				class="text-foreground decoration-foreground/50 hover:decoration-foreground font-medium underline underline-offset-2 transition-colors"
				>{node.label}</a
			>{/if}
	{/each}
{/snippet}

<div class={cn("flex", isUser ? "justify-end" : "justify-start")}>
	<div
		class={cn(
			"flex max-w-[85%] min-w-0 flex-col gap-1.5",
			isUser ? "ai-enter-right items-end" : "ai-enter items-start"
		)}
	>
		{#if isUser}
			<div class="bg-primary/10 text-foreground rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed">
				<span class="break-words whitespace-pre-wrap">{message.content}</span>
			</div>
		{:else if blocks.length > 0}
			<div
				class="border-border/50 bg-card text-muted-foreground rounded-2xl rounded-bl-md border px-4 py-2.5 text-sm"
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
							<p class="text-pretty break-words whitespace-pre-wrap">{block.value}</p>
						{/if}
					{/each}
				</div>
			</div>
		{:else if message.streaming}
			<div
				class="bg-card flex items-end gap-[3px] rounded-2xl rounded-bl-md px-4 py-3 backdrop-blur-xl"
				role="status"
				aria-label="Generating response"
			>
				{#each waveBars as bar (bar)}
					<span
						class="ai-wave-bar bg-foreground/40 h-[18px] w-0.5 rounded-[1px]"
						style="animation-delay: {bar * 0.12}s"
						aria-hidden="true"
					></span>
				{/each}
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
			<span class="text-muted-foreground px-1 text-[10px] tabular-nums">{timeLabel}</span>
		{/if}
	</div>
</div>
