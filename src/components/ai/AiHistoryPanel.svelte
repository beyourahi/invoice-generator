<script lang="ts">
	import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "$lib/components/ui/collapsible";
	import { ai } from "$lib/stores/ai.svelte";
	import { triggerUndo, deleteAction } from "$lib/ai/chat-client";
	import { ChevronDown, History, Trash2, Undo2 } from "@lucide/svelte";
	import { cn } from "$lib/utils";

	const formatTime = (iso: string): string => {
		try {
			return new Date(iso).toLocaleString(undefined, {
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit"
			});
		} catch {
			return iso;
		}
	};

	const statusColor = (status: string, applied: boolean): string => {
		if (status === "undone") return "text-muted-foreground";
		if (status === "rejected") return "text-muted-foreground";
		if (status === "failed" || status === "undo_failed") return "text-destructive";
		if (applied) return "text-foreground";
		return "text-muted-foreground";
	};

	const onUndo = async (id: string) => {
		await triggerUndo(id);
	};

	const onDelete = async (id: string) => {
		await deleteAction(id);
	};
</script>

<Collapsible
	open={ai.historyOpen}
	onOpenChange={(open: boolean) => ai.setHistoryOpen(open)}
	class="border-border/50 bg-card/30 rounded-md border"
>
	<CollapsibleTrigger class="text-foreground flex w-full items-center justify-between gap-2 px-3 py-2 text-xs">
		<span class="flex items-center gap-1.5">
			<History class="size-3.5" aria-hidden="true" />
			<span class="font-semibold whitespace-nowrap">AI History</span>
			<span class="text-muted-foreground whitespace-nowrap tabular-nums">({ai.historyActions.length})</span>
		</span>
		<ChevronDown
			class={cn("size-3.5 transition-transform duration-200", ai.historyOpen && "rotate-180")}
			aria-hidden="true"
		/>
	</CollapsibleTrigger>
	<CollapsibleContent>
		<div class="border-border/40 border-t px-3 py-2">
			<label class="text-muted-foreground mb-2 flex items-center gap-2 text-xs">
				<input
					type="checkbox"
					checked={ai.showUndone}
					onchange={e => ai.setShowUndone((e.currentTarget as HTMLInputElement).checked)}
				/>
				Show undone
			</label>

			{#if ai.visibleHistoryActions.length === 0}
				<p class="text-muted-foreground py-4 text-center text-xs text-balance">No actions yet</p>
			{:else}
				<ul class="max-h-72 space-y-1.5 overflow-y-auto pr-1">
					{#each ai.visibleHistoryActions as action (action.id)}
						<li
							class={cn(
								"border-border/40 bg-background/30 flex items-start gap-2 rounded-md border px-2 py-1.5 text-xs",
								statusColor(action.status, action.applied)
							)}
						>
							<div class="flex-1 space-y-0.5">
								<div class="flex items-center gap-1.5">
									<span class="font-mono text-[10px]">{action.toolName}</span>
									<span class="text-muted-foreground text-[10px] tracking-wide uppercase">
										{action.status}
									</span>
									{#if action.anomalyTriggered}
										<span class="text-[10px] text-yellow-300">⚠</span>
									{/if}
								</div>
								<div class="text-muted-foreground text-[10px] tabular-nums">
									{formatTime(action.createdAt)}
								</div>
								{#if action.error}
									<div class="text-destructive text-[10px] break-all">{action.error}</div>
								{/if}
							</div>
							<div class="flex shrink-0 items-center gap-1">
								{#if action.applied && action.status !== "undone"}
									<button
										type="button"
										onclick={() => onUndo(action.id)}
										class="text-foreground/80 pointer-fine:hover:text-foreground rounded p-1 transition-colors"
										aria-label="Undo"
										title="Undo"
									>
										<Undo2 class="size-3" aria-hidden="true" />
									</button>
								{/if}
								<button
									type="button"
									onclick={() => onDelete(action.id)}
									class="text-muted-foreground pointer-fine:hover:text-destructive rounded p-1 transition-colors"
									aria-label="Delete record"
									title="Delete record"
								>
									<Trash2 class="size-3" aria-hidden="true" />
								</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</CollapsibleContent>
</Collapsible>
