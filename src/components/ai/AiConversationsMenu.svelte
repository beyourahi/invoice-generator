<script lang="ts">
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from "$lib/components/ui/dropdown-menu";
	import { ai } from "$lib/stores/ai.svelte";
	import {
		createNewConversation,
		deleteConversation,
		renameConversation,
		switchConversation
	} from "$lib/ai/chat-client";
	import { ChevronDown, MessageSquarePlus, Pencil, Trash2 } from "@lucide/svelte";

	const activeTitle = $derived(ai.conversations.find(c => c.id === ai.activeConversationId)?.title ?? "New chat");

	const onRename = async (id: string, currentTitle: string) => {
		const next = prompt("Rename conversation", currentTitle);
		if (next && next.trim() !== currentTitle) {
			await renameConversation(id, next.trim());
		}
	};

	const onDelete = async (id: string) => {
		if (confirm("Delete this conversation? Action history will be preserved.")) {
			await deleteConversation(id);
		}
	};
</script>

<DropdownMenu>
	<DropdownMenuTrigger
		class="text-foreground pointer-fine:hover:bg-accent/50 inline-flex max-w-[14rem] items-center gap-1.5 truncate rounded-md px-2 py-1 text-xs transition-colors"
	>
		<span class="truncate font-medium">{activeTitle}</span>
		<ChevronDown class="size-3 shrink-0 opacity-70" aria-hidden="true" />
	</DropdownMenuTrigger>
	<DropdownMenuContent align="start" class="w-64">
		<DropdownMenuItem onclick={() => createNewConversation()}>
			<MessageSquarePlus class="size-3.5" aria-hidden="true" />
			New chat
		</DropdownMenuItem>
		{#if ai.conversations.length > 0}
			<DropdownMenuSeparator />
			{#each ai.conversations as conv (conv.id)}
				<DropdownMenuItem
					class="flex items-center justify-between gap-1.5"
					onclick={() => switchConversation(conv.id)}
				>
					<span class="flex-1 truncate text-xs">{conv.title}</span>
					<button
						type="button"
						class="text-muted-foreground pointer-fine:hover:text-foreground rounded p-0.5"
						onclick={e => {
							e.stopPropagation();
							onRename(conv.id, conv.title);
						}}
						aria-label="Rename"
					>
						<Pencil class="size-3" aria-hidden="true" />
					</button>
					<button
						type="button"
						class="text-muted-foreground pointer-fine:hover:text-destructive rounded p-0.5"
						onclick={e => {
							e.stopPropagation();
							onDelete(conv.id);
						}}
						aria-label="Delete"
					>
						<Trash2 class="size-3" aria-hidden="true" />
					</button>
				</DropdownMenuItem>
			{/each}
		{/if}
	</DropdownMenuContent>
</DropdownMenu>
