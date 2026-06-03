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
				return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
			case "rejected":
				return "border-chat-border-subtle bg-chat-surface text-chat-text-muted";
			case "failed":
				return "border-red-400/40 bg-red-400/10 text-red-300";
			case "pending_confirmation":
				return "border-amber-400/30 bg-amber-400/10 text-amber-300";
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
		class="chat-message-enter border-chat-border-subtle bg-chat-surface text-chat-text-secondary space-y-2.5 rounded-lg border p-3 text-xs"
	>
		<div class="text-chat-text-secondary flex items-center gap-1.5 font-medium">
			<Wand2 class="size-3.5" aria-hidden="true" />
			<span>Suggested rewrite</span>
		</div>
		<div class="space-y-1.5">
			<div class="rounded-md bg-red-400/5 px-2.5 py-1.5">
				<div class="text-chat-text-muted mb-0.5 text-[10px] font-medium tracking-wide uppercase">Current</div>
				<p class="text-chat-text-muted break-words whitespace-pre-wrap">
					{call.polish.oldText || "(empty)"}
				</p>
			</div>
			<div class="rounded-md bg-emerald-400/10 px-2.5 py-1.5">
				<div class="mb-0.5 text-[10px] font-medium tracking-wide text-emerald-300 uppercase">Proposed</div>
				<p class="text-chat-text-primary break-words whitespace-pre-wrap">{call.polish.newText}</p>
			</div>
		</div>
		<div class="flex items-center justify-end gap-2">
			<button
				type="button"
				onclick={onRejectPolish}
				class="text-chat-text-secondary hover:text-chat-text-primary hover:bg-chat-surface-hover border-chat-border-subtle bg-chat-bg inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 font-medium transition-colors"
			>
				<X class="size-3" aria-hidden="true" />
				Reject
			</button>
			<button
				type="button"
				onclick={onApplyPolish}
				class="bg-chat-accent-muted text-chat-text-primary hover:bg-chat-surface-hover inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 font-medium transition-colors"
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
				"flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-2.5 py-2 text-xs",
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
			<span class="tabular-nums">· {statusLabel}</span>
			{#if canUndo}
				<button
					type="button"
					onclick={onUndo}
					disabled={undoing}
					class={cn(
						"text-chat-text-secondary hover:text-chat-text-primary hover:bg-chat-surface-hover border-chat-border-subtle bg-chat-bg ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
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
