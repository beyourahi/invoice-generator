<script lang="ts">
	import type { AiToolCall } from "$lib/stores/ai.svelte";
	import { triggerUndo, respondToPolish } from "$lib/ai/chat-client";
	import { toolLabel } from "$lib/ai/tool-labels";
	import { Check, CheckCircle2, CircleX, Loader2, ShieldAlert, Undo2, Wand2, X } from "@lucide/svelte";
	import { cn } from "$lib/utils";

	let { call }: { call: AiToolCall } = $props();

	const isPolishProposal = $derived(!!call.polish && call.status === "pending_confirmation");

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
		if (call.undone) return "border-border bg-card text-muted-foreground";
		switch (call.status) {
			case "applied":
				return "border-[var(--status-active-border)] bg-[var(--status-active-bg)] text-[var(--status-active-foreground)]";
			case "rejected":
				return "border-border bg-card text-muted-foreground";
			case "failed":
				return "border-destructive/40 bg-destructive/10 text-destructive";
			case "pending_confirmation":
				return "border-amber-400/30 bg-amber-400/10 text-amber-300";
			default:
				return "border-border bg-card text-muted-foreground";
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

	const onApplyPolish = () => respondToPolish(call.id, true);
	const onRejectPolish = () => respondToPolish(call.id, false);
</script>

{#if isPolishProposal && call.polish}
	<div class="ai-enter border-border bg-card text-muted-foreground space-y-2.5 rounded-lg border p-3 text-xs">
		<div class="text-muted-foreground flex items-center gap-1.5 font-medium">
			<Wand2 class="size-3.5" aria-hidden="true" />
			<span>Suggested rewrite</span>
		</div>
		<div class="space-y-1.5">
			<div class="border-border/50 bg-destructive/5 rounded-md border px-2.5 py-1.5">
				<div class="text-muted-foreground mb-0.5 text-[10px] font-medium tracking-wide uppercase">Current</div>
				<p class="text-muted-foreground break-words whitespace-pre-wrap">
					{call.polish.oldText || "(empty)"}
				</p>
			</div>
			<div
				class="rounded-md border border-[var(--status-active-border)] bg-[var(--status-active-bg)] px-2.5 py-1.5"
			>
				<div
					class="mb-0.5 text-[10px] font-medium tracking-wide text-[var(--status-active-foreground)] uppercase"
				>
					Proposed
				</div>
				<p class="text-foreground break-words whitespace-pre-wrap">{call.polish.newText}</p>
			</div>
		</div>
		<div class="flex items-center justify-end gap-2">
			<button
				type="button"
				onclick={onRejectPolish}
				class="text-muted-foreground pointer-fine:hover:text-foreground pointer-fine:hover:bg-muted border-border bg-card inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 font-medium transition-colors"
			>
				<X class="size-3" aria-hidden="true" />
				Reject
			</button>
			<button
				type="button"
				onclick={onApplyPolish}
				class="bg-primary/10 text-foreground pointer-fine:hover:bg-muted inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 font-medium transition-colors"
			>
				<Check class="size-3" aria-hidden="true" />
				Apply
			</button>
		</div>
	</div>
{:else}
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
		<span class="font-medium break-all">{toolLabel(call.name)}</span>
		<span class="text-muted-foreground tabular-nums">· {statusLabel}</span>
		{#if call.error}
			<span class="text-destructive/80 w-full break-all">{call.error}</span>
		{/if}
		{#if canUndo}
			<button
				type="button"
				onclick={onUndo}
				disabled={undoing}
				class={cn(
					"text-muted-foreground pointer-fine:hover:text-foreground pointer-fine:hover:bg-muted border-border bg-card ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
					undoing && "cursor-wait"
				)}
			>
				<Undo2 class="size-3" aria-hidden="true" />
				Undo
			</button>
		{/if}
	</div>
{/if}
