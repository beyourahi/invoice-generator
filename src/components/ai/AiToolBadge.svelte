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
				return "Working…";
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

<div
	class={cn(
		"ai-enter flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-2.5 py-2 text-xs",
		statusClasses
	)}
>
	<span class="flex size-4 shrink-0 items-center justify-center">
		{#if call.status === "pending" || call.status === "pending_confirmation"}
			<Loader2 class="size-3.5 animate-spin" aria-hidden="true" />
		{:else if call.status === "applied" && !call.undone}
			<CheckCircle2 class="size-3.5" aria-hidden="true" />
		{:else if call.status === "failed"}
			<CircleX class="size-3.5" aria-hidden="true" />
		{:else}
			<ShieldAlert class="size-3.5" aria-hidden="true" />
		{/if}
	</span>
	<span class="font-medium break-all">{call.name}</span>
	<span class="text-muted-foreground/80 tabular-nums">· {statusLabel}</span>
	{#if call.error}
		<span class="text-destructive/80 w-full break-all">{call.error}</span>
	{/if}
	{#if canUndo}
		<button
			type="button"
			onclick={onUndo}
			disabled={undoing}
			class={cn(
				"text-foreground/80 pointer-fine:hover:text-foreground pointer-fine:hover:bg-background border-border/70 bg-background/60 ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
				undoing && "cursor-wait"
			)}
		>
			<Undo2 class="size-3" aria-hidden="true" />
			Undo
		</button>
	{/if}
</div>
