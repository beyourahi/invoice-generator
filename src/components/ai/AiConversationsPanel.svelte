<script lang="ts">
	import { ai } from "$lib/stores/ai.svelte";
	import {
		createNewConversation,
		deleteConversation,
		renameConversation,
		switchConversation
	} from "$lib/ai/chat-client";
	import { MessageSquarePlus, Pencil, Trash2 } from "@lucide/svelte";
	import { cn } from "$lib/utils";

	const onNew = async () => {
		await createNewConversation();
		ai.closeRail();
	};

	const onSwitch = async (id: string) => {
		if (id !== ai.activeConversationId) await switchConversation(id);
		ai.closeRail();
	};

	const onRename = async (id: string, currentTitle: string) => {
		const next = prompt("Rename conversation", currentTitle);
		if (next && next.trim() && next.trim() !== currentTitle) {
			await renameConversation(id, next.trim());
		}
	};

	const onDelete = async (id: string) => {
		if (confirm("Delete this conversation? Action history will be preserved.")) {
			await deleteConversation(id);
		}
	};
</script>

<div class="space-y-2">
	<button
		type="button"
		onclick={onNew}
		class="border-border/50 bg-card text-foreground pointer-fine:hover:border-border pointer-fine:hover:bg-muted flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors"
	>
		<MessageSquarePlus class="size-3.5 shrink-0" aria-hidden="true" />
		New chat
	</button>

	{#if ai.conversations.length === 0}
		<p class="text-muted-foreground py-3 text-center text-xs text-balance">No conversations yet.</p>
	{:else}
		<ul class="ai-scroll max-h-60 space-y-1 overflow-y-auto pr-1">
			{#each ai.conversations as conv (conv.id)}
				{@const active = conv.id === ai.activeConversationId}
				<li
					class={cn(
						"flex items-center gap-1 rounded-lg border px-2 py-1.5 transition-colors",
						active ? "border-border bg-muted" : "border-border/50 bg-card pointer-fine:hover:bg-muted"
					)}
				>
					<button
						type="button"
						onclick={() => onSwitch(conv.id)}
						class="flex min-w-0 flex-1 items-center gap-1.5 text-left"
						aria-current={active ? "true" : undefined}
					>
						{#if active}
							<span class="bg-foreground size-1.5 shrink-0 rounded-full" aria-hidden="true"></span>
						{/if}
						<span
							class={cn(
								"truncate text-xs",
								active ? "text-foreground font-medium" : "text-muted-foreground"
							)}
						>
							{conv.title}
						</span>
					</button>
					<button
						type="button"
						class="text-muted-foreground pointer-fine:hover:text-foreground pointer-fine:hover:bg-muted rounded-md p-1 transition-colors"
						onclick={() => onRename(conv.id, conv.title)}
						aria-label="Rename conversation {conv.title}"
						title="Rename"
					>
						<Pencil class="size-3" aria-hidden="true" />
					</button>
					<button
						type="button"
						class="text-muted-foreground pointer-fine:hover:text-destructive pointer-fine:hover:bg-destructive/10 rounded-md p-1 transition-colors"
						onclick={() => onDelete(conv.id)}
						aria-label="Delete conversation {conv.title}"
						title="Delete"
					>
						<Trash2 class="size-3" aria-hidden="true" />
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
