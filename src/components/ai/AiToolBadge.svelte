<script lang="ts">
	import type { AiToolCall } from "$lib/stores/ai.svelte";
	import { triggerUndo } from "$lib/ai/chat-client";
	import { CheckCircle2, CircleX, Loader2, ShieldAlert, Undo2 } from "@lucide/svelte";
	import { cn } from "$lib/utils";

	let { call }: { call: AiToolCall } = $props();

	const statusLabel = $derived.by(() => {
		switch (call.status) {
			case "applied":
				return call.undone ? "Undone" : "Applied";
			case "rejected":
				return "Rejected";
			case "failed":
				return "Failed";
			case "pending_confirmation":
				return "Awaiting confirmation";
			default:
				return "Pending";
		}
	});

	const statusClasses = $derived.by(() => {
		if (call.undone) return "border-muted/60 bg-muted/30 text-muted-foreground";
		switch (call.status) {
			case "applied":
				return "border-[var(--status-active-border)] bg-[var(--status-active-bg)] text-[var(--status-active-foreground)]";
			case "rejected":
				return "border-muted/50 bg-muted/30 text-muted-foreground";
			case "failed":
				return "border-destructive/40 bg-destructive/10 text-destructive";
			case "pending_confirmation":
				return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
			default:
				return "border-border bg-muted/40 text-muted-foreground";
		}
	});

	const canUndo = $derived(call.status === "applied" && !call.undone && !!call.actionId);
	let undoing = $state(false);

	const onUndo = async () => {
		if (!call.actionId || undoing) return;
		undoing = true;
		await triggerUndo(call.actionId);
		undoing = false;
	};
</script>

<div class={cn("flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs", statusClasses)}>
	{#if call.status === "pending" || call.status === "pending_confirmation"}
		<Loader2 class="size-3 animate-spin" aria-hidden="true" />
	{:else if call.status === "applied" && !call.undone}
		<CheckCircle2 class="size-3" aria-hidden="true" />
	{:else if call.status === "failed"}
		<CircleX class="size-3" aria-hidden="true" />
	{:else}
		<ShieldAlert class="size-3" aria-hidden="true" />
	{/if}
	<span class="font-medium">{call.name}</span>
	<span class="text-muted-foreground/80 tabular-nums">{statusLabel}</span>
	{#if call.error}
		<span class="text-destructive/80 break-all">— {call.error}</span>
	{/if}
	{#if canUndo}
		<button
			type="button"
			onclick={onUndo}
			disabled={undoing}
			class="text-foreground/80 hover:text-foreground border-border/70 bg-background/60 ml-auto inline-flex items-center gap-1 rounded border px-2 py-0.5 transition-colors disabled:opacity-50"
		>
			<Undo2 class="size-3" aria-hidden="true" />
			Undo
		</button>
	{/if}
</div>
