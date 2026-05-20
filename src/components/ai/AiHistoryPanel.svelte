<script lang="ts">
	import { Switch } from "$lib/components/ui/switch";
	import { Label } from "$lib/components/ui/label";
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle
	} from "$lib/components/ui/alert-dialog";
	import { ai } from "$lib/stores/ai.svelte";
	import { triggerUndo, deleteAction } from "$lib/ai/chat-client";
	import { Trash2, Undo2 } from "@lucide/svelte";
	import { cn } from "$lib/utils";

	const selected = $state(new Set<string>());
	let pendingDelete = $state<string[] | null>(null);

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

	const toggleSelected = (id: string) => {
		if (selected.has(id)) {
			selected.delete(id);
		} else {
			selected.add(id);
		}
	};

	const clearSelection = () => {
		selected.clear();
	};

	const confirmDelete = async () => {
		const ids = pendingDelete;
		pendingDelete = null;
		if (!ids) return;
		for (const id of ids) {
			await deleteAction(id);
			selected.delete(id);
		}
	};
</script>

<div class="space-y-2.5">
	<div class="flex items-center justify-between gap-2">
		<Label for="ai-show-undone" class="text-muted-foreground text-xs">Show undone actions</Label>
		<Switch id="ai-show-undone" checked={ai.showUndone} onCheckedChange={(v: boolean) => ai.setShowUndone(v)} />
	</div>

	{#if selected.size > 0}
		<div
			class="border-border/50 bg-muted/30 flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs"
		>
			<span class="text-muted-foreground tabular-nums">{selected.size} selected</span>
			<div class="flex items-center gap-1.5">
				<button
					type="button"
					onclick={clearSelection}
					class="text-muted-foreground pointer-fine:hover:text-foreground rounded-md px-2 py-1 font-medium transition-colors"
				>
					Clear
				</button>
				<button
					type="button"
					onclick={() => (pendingDelete = [...selected])}
					class="text-destructive pointer-fine:hover:bg-destructive/10 border-destructive/40 inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium transition-colors"
				>
					<Trash2 class="size-3" aria-hidden="true" />
					Delete selected
				</button>
			</div>
		</div>
	{/if}

	{#if ai.visibleHistoryActions.length === 0}
		<p class="text-muted-foreground py-5 text-center text-xs text-balance">No actions recorded yet.</p>
	{:else}
		<ul class="ai-scroll max-h-72 space-y-1.5 overflow-y-auto pr-1">
			{#each ai.visibleHistoryActions as action (action.id)}
				<li
					class="border-border/50 bg-background/40 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs"
				>
					<input
						type="checkbox"
						class="mt-0.5 shrink-0"
						checked={selected.has(action.id)}
						onchange={() => toggleSelected(action.id)}
						aria-label="Select {action.toolName} record"
					/>
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
								<span class="text-[10px] text-yellow-300" title="Safety check triggered">⚠</span>
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
								aria-label="Undo {action.toolName}"
								title="Undo"
							>
								<Undo2 class="size-3" aria-hidden="true" />
							</button>
						{/if}
						<button
							type="button"
							onclick={() => (pendingDelete = [action.id])}
							class="text-muted-foreground pointer-fine:hover:text-destructive pointer-fine:hover:bg-destructive/10 rounded-md p-1.5 transition-colors"
							aria-label="Delete {action.toolName} record"
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

<AlertDialog
	open={pendingDelete !== null}
	onOpenChange={(open: boolean) => {
		if (!open) pendingDelete = null;
	}}
>
	<AlertDialogContent class="max-w-md">
		<AlertDialogHeader>
			<AlertDialogTitle class="text-balance">
				{#if pendingDelete && pendingDelete.length > 1}
					Delete {pendingDelete.length} history records?
				{:else}
					Delete this history record?
				{/if}
			</AlertDialogTitle>
			<AlertDialogDescription class="text-pretty">
				Deleting a history record removes it permanently. Any action it contains can no longer be undone from
				the copilot.
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter class="gap-2">
			<AlertDialogCancel onclick={() => (pendingDelete = null)}>Keep</AlertDialogCancel>
			<AlertDialogAction onclick={confirmDelete}>Delete</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
