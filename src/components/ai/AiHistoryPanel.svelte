<script lang="ts">
	import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "$lib/components/ui/collapsible";
	import { Switch } from "$lib/components/ui/switch";
	import { Label } from "$lib/components/ui/label";
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
		if (status === "undone" || status === "rejected") return "text-muted-foreground";
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
	class="border-border/50 bg-card/40 rounded-lg border"
>
	<CollapsibleTrigger
		class="text-foreground pointer-fine:hover:bg-accent/40 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs transition-colors"
	>
		<span class="flex items-center gap-1.5">
			<History class="text-muted-foreground size-3.5" aria-hidden="true" />
			<span class="font-semibold whitespace-nowrap">Action history</span>
			<span
				class="bg-muted/70 text-muted-foreground rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums"
			>
				{ai.historyActions.length}
			</span>
		</span>
		<ChevronDown
			class={cn(
				"text-muted-foreground size-3.5 transition-transform duration-200",
				ai.historyOpen && "rotate-180"
			)}
			aria-hidden="true"
		/>
	</CollapsibleTrigger>
	<CollapsibleContent>
		<div class="border-border/40 border-t px-3 py-2.5">
			<div class="mb-2.5 flex items-center justify-between gap-2">
				<Label for="ai-show-undone" class="text-muted-foreground text-xs">Show undone actions</Label>
				<Switch
					id="ai-show-undone"
					checked={ai.showUndone}
					onCheckedChange={(v: boolean) => ai.setShowUndone(v)}
				/>
			</div>

			{#if ai.visibleHistoryActions.length === 0}
				<p class="text-muted-foreground py-5 text-center text-xs text-balance">No actions recorded yet.</p>
			{:else}
				<ul class="ai-scroll max-h-72 space-y-1.5 overflow-y-auto pr-1">
					{#each ai.visibleHistoryActions as action (action.id)}
						<li
							class="border-border/50 bg-background/40 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs"
						>
							<div class="min-w-0 flex-1 space-y-1">
								<div class="flex flex-wrap items-center gap-1.5">
									<span
										class={cn(
											"font-mono text-[10px] break-all",
											statusColor(action.status, action.applied)
										)}
									>
										{action.toolName}
									</span>
									<span
										class="bg-muted/70 text-muted-foreground rounded px-1.5 py-px text-[9px] font-medium tracking-wide uppercase"
									>
										{action.status}
									</span>
									{#if action.anomalyTriggered}
										<span class="text-[10px] text-yellow-300" title="Safety check triggered">⚠</span
										>
									{/if}
								</div>
								<div class="text-muted-foreground/70 text-[10px] tabular-nums">
									{formatTime(action.createdAt)}
								</div>
								{#if action.error}
									<div class="text-destructive text-[10px] break-all">{action.error}</div>
								{/if}
							</div>
							<div class="flex shrink-0 items-center gap-0.5">
								{#if action.applied && action.status !== "undone"}
									<button
										type="button"
										onclick={() => onUndo(action.id)}
										class="text-muted-foreground pointer-fine:hover:text-foreground pointer-fine:hover:bg-accent/60 rounded-md p-1.5 transition-colors"
										aria-label="Undo"
										title="Undo"
									>
										<Undo2 class="size-3" aria-hidden="true" />
									</button>
								{/if}
								<button
									type="button"
									onclick={() => onDelete(action.id)}
									class="text-muted-foreground pointer-fine:hover:text-destructive pointer-fine:hover:bg-destructive/10 rounded-md p-1.5 transition-colors"
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
