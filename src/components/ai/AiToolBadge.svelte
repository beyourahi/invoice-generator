<!--
	Status chip for one tool call (working / applied / rejected / failed / awaiting confirmation),
	with inline Undo for applied+reversible actions. Polish proposals render instead as an
	accept/reject diff card (old vs new text).
-->
<script lang="ts">
	import type { AiToolCall } from "$lib/stores/ai.svelte";
	import { triggerUndo, respondToPolish } from "$lib/ai/chat-client";
	import { toolLabel } from "$lib/ai/tool-labels";
	import { Check, CheckCircle2, CircleX, Loader2, ShieldAlert, Undo2, Wand2, X } from "@lucide/svelte";
	import { cn } from "$lib/utils";
	import AiAnomalyWarning from "./AiAnomalyWarning.svelte";

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
		if (call.undone) return "border-chat-border-subtle bg-chat-surface text-chat-text-muted";
		switch (call.status) {
			case "applied":
				return "border-signal/40 bg-signal/10 text-chat-text-primary";
			case "rejected":
				return "border-chat-border-subtle bg-chat-surface text-chat-text-muted";
			case "failed":
				return "border-destructive/40 bg-destructive/10 text-destructive";
			case "pending_confirmation":
				return "border-chat-border bg-chat-surface text-chat-text-secondary";
			default:
				return "border-chat-border-subtle bg-chat-surface text-chat-text-secondary";
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
	<div
		class="chat-message-enter border-chat-border-subtle bg-chat-surface text-chat-text-secondary space-y-2.5 rounded-lg border border-solid p-3 text-xs"
	>
		<div class="text-chat-text-secondary text-caption flex items-center gap-1.5 tracking-[0.18em] uppercase">
			<Wand2 class="size-3.5" aria-hidden="true" />
			<span>Suggested rewrite</span>
		</div>
		<div class="space-y-1.5">
			<div class="bg-chat-bg rounded-md px-2.5 py-1.5">
				<div class="text-chat-text-muted text-micro mb-0.5 tracking-[0.12em] uppercase">Current</div>
				<p class="text-chat-text-muted break-words whitespace-pre-wrap">
					{call.polish.oldText || "(empty)"}
				</p>
			</div>
			<div class="bg-signal/10 rounded-md px-2.5 py-1.5">
				<div class="text-chat-text-secondary text-micro mb-0.5 tracking-[0.12em] uppercase">Proposed</div>
				<p class="text-chat-text-primary break-words whitespace-pre-wrap">{call.polish.newText}</p>
			</div>
		</div>
		<div class="flex items-center justify-end gap-2">
			<button
				type="button"
				onclick={onRejectPolish}
				class="text-chat-text-secondary hover:text-chat-text-primary hover:bg-ink-2 border-hair bg-chat-bg text-caption inline-flex touch-manipulation items-center gap-1 rounded-full border px-3 py-1.5 tracking-[0.1em] whitespace-nowrap uppercase transition-colors ease-[var(--ease)]"
			>
				<X class="size-3" aria-hidden="true" />
				Reject
			</button>
			<button
				type="button"
				onclick={onApplyPolish}
				class="bg-signal text-background hover:bg-signal/90 text-caption inline-flex touch-manipulation items-center gap-1 rounded-full px-3 py-1.5 tracking-[0.1em] whitespace-nowrap uppercase transition-colors ease-[var(--ease)]"
			>
				<Check class="size-3" aria-hidden="true" />
				Apply
			</button>
		</div>
	</div>
{:else}
	<div class="chat-message-enter flex w-full flex-col gap-1.5">
		<div
			class={cn(
				"flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-solid px-2.5 py-2 text-xs",
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
			<span class="font-medium break-words">{toolLabel(call.name)}</span>
			<span class="text-chat-text-muted text-micro tracking-[0.12em] uppercase tabular-nums">
				· {statusLabel}
			</span>
			{#if canUndo}
				<button
					type="button"
					onclick={onUndo}
					disabled={undoing}
					class={cn(
						"text-chat-text-secondary hover:text-chat-text-primary hover:bg-ink-2 border-hair bg-chat-bg text-micro ml-auto inline-flex touch-manipulation items-center gap-1 rounded-full border px-2.5 py-1  tracking-[0.1em] whitespace-nowrap uppercase transition-colors ease-[var(--ease)] disabled:cursor-not-allowed disabled:opacity-50",
						undoing && "cursor-wait"
					)}
				>
					<Undo2 class="size-3" aria-hidden="true" />
					Undo
				</button>
			{/if}
			{#if call.error}
				<span class="w-full break-words">{call.error}</span>
			{/if}
		</div>
		{#if call.anomalies.length > 0}
			<AiAnomalyWarning anomalies={call.anomalies} />
		{/if}
	</div>
{/if}
