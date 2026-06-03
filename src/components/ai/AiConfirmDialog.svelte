<!--
	Globally-mounted modal that gates Tier-B (destructive / money-mutating) tool calls awaiting
	confirmation. Single pending call shows a diff + undo summary; multiple show a batch list where
	each item can be individually rejected. Each resolved call calls back into the executor's promise.
-->
<script lang="ts">
	import { tick } from "svelte";
	import { fade, scale } from "svelte/transition";
	import { cubicOut } from "svelte/easing";
	import { ai } from "$lib/stores/ai.svelte";
	import { respondToConfirmation, respondToAllConfirmations } from "$lib/ai/chat-client";
	import { motionDuration } from "$lib/motion";
	import { ShieldCheck, Undo2 } from "@lucide/svelte";
	import AiAnomalyWarning from "./AiAnomalyWarning.svelte";
	import { toolLabel } from "$lib/ai/tool-labels";

	const first = $derived(ai.pendingConfirmations[0] ?? null);
	const isBatch = $derived(ai.pendingConfirmations.length > 1);

	// In batch mode, `rejected` holds toolCallIds to skip; on Apply, each call resolves true unless rejected.
	const rejected = $state(new Set<string>());

	const onApplyAll = () => {
		for (const req of [...ai.pendingConfirmations]) {
			req.resolve(!rejected.has(req.toolCallId));
		}
		rejected.clear();
	};

	const onCancelAll = () => {
		respondToAllConfirmations(false);
		rejected.clear();
	};

	const onToggleReject = (id: string) => {
		if (rejected.has(id)) rejected.delete(id);
		else rejected.add(id);
	};

	const onConfirm = () => {
		if (first) respondToConfirmation(first.toolCallId, true);
	};

	const onReject = () => {
		if (first) respondToConfirmation(first.toolCallId, false);
	};

	const focusOnMount = (node: HTMLElement) => {
		tick().then(() => node.focus());
	};

	const onKeydown = (event: KeyboardEvent) => {
		if (!first || event.key !== "Escape") return;
		event.preventDefault();
		if (isBatch) onCancelAll();
		else onReject();
	};
</script>

<svelte:window onkeydown={onKeydown} />

{#if first}
	<div
		role="dialog"
		aria-modal="true"
		aria-labelledby="ai-confirm-title"
		class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
		transition:fade={{ duration: motionDuration("fast") }}
	>
		<div
			class="border-chat-border bg-chat-bg flex max-h-[85vh] w-[min(30rem,calc(100vw-2rem))] flex-col rounded-2xl border shadow-[var(--chat-shadow)]"
			transition:scale={{ duration: motionDuration("base"), start: 0.95, easing: cubicOut }}
		>
			<div class="border-chat-border flex items-center gap-2 border-b px-5 py-4">
				<ShieldCheck class="size-4 shrink-0 text-amber-300" aria-hidden="true" />
				<h2 id="ai-confirm-title" class="text-chat-text-primary text-sm font-medium text-balance">
					{isBatch ? `Confirm ${ai.pendingConfirmations.length} operations` : "Confirm this change"}
				</h2>
			</div>

			<div class="chat-scrollbar flex-1 space-y-3 overflow-y-auto px-5 py-4">
				{#if isBatch}
					<p class="text-chat-text-secondary text-sm text-pretty">
						Review the proposed changes below. Toggle reject on any item to skip it.
					</p>
					<ul class="border-chat-border-subtle max-h-72 space-y-2 overflow-y-auto rounded-lg border p-2">
						{#each ai.pendingConfirmations as req (req.toolCallId)}
							<li class="border-chat-border-subtle bg-chat-surface rounded-md border p-2 text-xs">
								<div class="flex items-start gap-2">
									<input
										type="checkbox"
										class="mt-0.5"
										checked={rejected.has(req.toolCallId)}
										onchange={() => onToggleReject(req.toolCallId)}
										aria-label="Reject {req.humanLabel}"
									/>
									<div class="flex flex-1 flex-col gap-1">
										<span
											class={rejected.has(req.toolCallId)
												? "text-chat-text-muted line-through"
												: "text-chat-text-primary"}
										>
											{req.humanLabel}
										</span>
										<span
											class="text-chat-text-muted font-mono text-[10px] tracking-wide uppercase"
										>
											{toolLabel(req.toolName)}
										</span>
										{#if req.anomalies.length > 0}
											<AiAnomalyWarning anomalies={req.anomalies} />
										{/if}
										<span class="text-chat-text-muted text-[10px] text-pretty">
											{req.inverseSummary}
										</span>
									</div>
								</div>
							</li>
						{/each}
					</ul>
					<p class="text-chat-text-muted text-xs text-pretty">
						{ai.pendingConfirmations.length - rejected.size} will run; {rejected.size} will be rejected.
					</p>
				{:else}
					<p class="text-chat-text-secondary text-sm text-pretty">{first.humanLabel}.</p>

					{#if first.diff.length > 0}
						<div class="border-chat-border-subtle bg-chat-surface space-y-2.5 rounded-lg border p-3">
							{#each first.diff as row, i (i)}
								<div class="space-y-1">
									<div class="text-chat-text-muted font-mono text-[10px] tracking-wide uppercase">
										{row.label}
									</div>
									<div class="flex items-start gap-2 text-xs">
										<span class="shrink-0 font-mono text-red-300/70 select-none">−</span>
										<span class="text-chat-text-muted min-w-0 break-words line-through">
											{row.current}
										</span>
									</div>
									<div class="flex items-start gap-2 text-xs">
										<span class="shrink-0 font-mono text-emerald-300 select-none">+</span>
										<span class="text-chat-text-primary min-w-0 font-medium break-words">
											{row.proposed}
										</span>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					{#if first.anomalies.length > 0}
						<AiAnomalyWarning anomalies={first.anomalies} />
					{/if}

					<p class="text-chat-text-muted flex items-start gap-1.5 text-[11px] text-pretty">
						<Undo2 class="mt-px size-3 shrink-0" aria-hidden="true" />
						<span>{first.inverseSummary}</span>
					</p>
				{/if}
			</div>

			<div class="border-chat-border flex items-center justify-end gap-2 border-t px-5 py-4">
				<button
					type="button"
					onclick={isBatch ? onCancelAll : onReject}
					use:focusOnMount
					class="border-chat-border-subtle bg-chat-surface text-chat-text-primary hover:bg-chat-surface-hover focus-visible:ring-chat-accent inline-flex h-9 cursor-pointer items-center rounded-md border px-4 text-sm transition-colors focus:outline-none focus-visible:ring-2"
				>
					{isBatch ? "Reject all" : "Reject"}
				</button>
				<button
					type="button"
					onclick={isBatch ? onApplyAll : onConfirm}
					class="bg-chat-accent text-chat-bg hover:bg-chat-text-primary focus-visible:ring-chat-accent inline-flex h-9 cursor-pointer items-center rounded-md px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2"
				>
					{isBatch ? "Apply selected" : "Confirm"}
				</button>
			</div>
		</div>
	</div>
{/if}
