<script lang="ts">
	import { ai } from "$lib/stores/ai.svelte";
	import { deleteConversation, renameConversation, switchConversation } from "$lib/ai/chat-client";
	import { ArrowLeft, Clock, Pencil, Trash2 } from "@lucide/svelte";
	import { cn } from "$lib/utils";

	const onBack = () => ai.closeRail();

	const onSwitch = async (id: string) => {
		if (id !== ai.activeConversationId) await switchConversation(id);
		ai.closeRail();
	};

	const onRename = async (id: string, currentTitle: string, event: MouseEvent) => {
		event.stopPropagation();
		const next = prompt("Rename conversation", currentTitle);
		if (next && next.trim() && next.trim() !== currentTitle) {
			await renameConversation(id, next.trim());
		}
	};

	const onDelete = async (id: string, event: MouseEvent) => {
		event.stopPropagation();
		if (confirm("Delete this conversation? Action history will be preserved.")) {
			await deleteConversation(id);
		}
	};

	const formatTime = (iso: string): string => {
		const parsed = Date.parse(iso);
		if (Number.isNaN(parsed)) return "";
		const diff = Date.now() - parsed;
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);
		if (minutes < 1) return "just now";
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		return new Date(parsed).toLocaleDateString("en-US", { month: "short", day: "numeric" });
	};
</script>

<div class="flex h-full flex-col">
	<div class="border-chat-border flex items-center justify-between border-b px-5 py-4">
		<div class="flex items-center gap-3">
			<button
				type="button"
				onclick={onBack}
				class="hover:bg-chat-surface-hover rounded-xl p-1.5 transition-colors"
				aria-label="Back to chat"
			>
				<ArrowLeft class="text-chat-icon-muted h-4 w-4" />
			</button>
			<span class="text-chat-text-primary text-sm font-medium">chat history</span>
		</div>
	</div>

	<div class="chat-scrollbar flex-1 overflow-y-auto">
		{#if ai.conversations.length === 0}
			<div class="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
				<div class="bg-chat-accent-subtle mb-4 flex h-12 w-12 items-center justify-center rounded-full">
					<Clock class="text-chat-icon-muted h-5 w-5" />
				</div>
				<p class="text-chat-text-secondary text-sm font-medium text-balance">no conversations yet</p>
				<p class="text-chat-text-muted mt-1 text-xs text-pretty">your chats will appear here.</p>
			</div>
		{:else}
			<div class="flex flex-col gap-1.5 px-3 py-3">
				{#each ai.conversations as conversation (conversation.id)}
					{@const active = conversation.id === ai.activeConversationId}
					<div
						class={cn(
							"group relative flex items-start gap-3 rounded-xl border px-4 py-3 transition-all duration-200",
							active
								? "border-chat-border bg-chat-surface"
								: "border-chat-border-subtle hover:border-chat-border hover:bg-chat-surface-hover"
						)}
					>
						<button
							type="button"
							onclick={() => onSwitch(conversation.id)}
							class="min-w-0 flex-1 text-left"
							aria-current={active ? "true" : undefined}
						>
							<p
								class={cn(
									"truncate text-sm",
									active ? "text-chat-text-primary font-medium" : "text-chat-text-primary"
								)}
							>
								{conversation.title}
							</p>
							<p class="text-chat-text-muted mt-1.5 text-[10px]">
								{formatTime(conversation.updatedAt)}
							</p>
						</button>
						<div class="flex shrink-0 items-center gap-1">
							<button
								type="button"
								onclick={e => onRename(conversation.id, conversation.title, e)}
								class="text-chat-text-muted hover:bg-chat-surface-hover hover:text-chat-text-primary rounded-lg p-1.5 opacity-0 transition-all duration-150 group-hover:opacity-100 max-md:opacity-100"
								aria-label="Rename conversation"
							>
								<Pencil class="h-3.5 w-3.5" />
							</button>
							<button
								type="button"
								onclick={e => onDelete(conversation.id, e)}
								class="text-chat-text-muted rounded-lg p-1.5 opacity-0 transition-all duration-150 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 max-md:bg-red-500/10 max-md:text-red-400 max-md:opacity-100"
								aria-label="Delete conversation"
							>
								<Trash2 class="h-3.5 w-3.5" />
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
