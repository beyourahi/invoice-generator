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
			class="border-border bg-popover flex max-h-[85vh] w-[min(30rem,calc(100vw-2rem))] flex-col rounded-2xl border border-solid shadow-2xl"
			transition:scale={{ duration: motionDuration("base"), start: 0.95, easing: cubicOut }}
		>
			<div class="border-border flex items-center gap-2 border-b border-solid px-5 py-4">
				<ShieldCheck class="size-4 shrink-0 text-amber-300" aria-hidden="true" />
				<h2 id="ai-confirm-title" class="text-foreground text-sm font-medium text-balance">
					{isBatch ? `Confirm ${ai.pendingConfirmations.length} operations` : "Confirm this change"}
				</h2>
			</div>

			<div class="ai-scroll flex-1 space-y-3 overflow-y-auto px-5 py-4">
				{#if isBatch}
					<p class="text-muted-foreground text-sm text-pretty">
						Review the proposed changes below. Toggle reject on any item to skip it.
					</p>
					<ul class="border-border max-h-72 space-y-2 overflow-y-auto rounded-lg border border-solid p-2">
						{#each ai.pendingConfirmations as req (req.toolCallId)}
							<li class="border-border bg-card rounded-md border border-solid p-2 text-xs">
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
												? "text-muted-foreground line-through"
												: "text-foreground"}
										>
											{req.humanLabel}
										</span>
										<span
											class="text-muted-foreground font-mono text-[10px] tracking-wide uppercase"
										>
											{toolLabel(req.toolName)}
										</span>
										{#if req.anomalies.length > 0}
											<AiAnomalyWarning anomalies={req.anomalies} />
										{/if}
										<span class="text-muted-foreground text-[10px] text-pretty">
											{req.inverseSummary}
										</span>
									</div>
								</div>
							</li>
						{/each}
					</ul>
					<p class="text-muted-foreground text-xs text-pretty">
						{ai.pendingConfirmations.length - rejected.size} will run; {rejected.size} will be rejected.
					</p>
				{:else}
					<p class="text-muted-foreground text-sm text-pretty">{first.humanLabel}.</p>

					{#if first.diff.length > 0}
						<div class="border-border bg-background space-y-2.5 rounded-lg border border-solid p-3">
							{#each first.diff as row, i (i)}
								<div class="space-y-1">
									<div class="text-muted-foreground font-mono text-[10px] tracking-wide uppercase">
										{row.label}
									</div>
									<div class="flex items-start gap-2 text-xs">
										<span class="text-destructive/70 shrink-0 font-mono select-none">−</span>
										<span class="text-muted-foreground min-w-0 break-words line-through">
											{row.current}
										</span>
									</div>
									<div class="flex items-start gap-2 text-xs">
										<span class="text-courier-accent shrink-0 font-mono select-none">+</span>
										<span class="text-foreground min-w-0 font-medium break-words">
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

					<p class="text-muted-foreground flex items-start gap-1.5 text-[11px] text-pretty">
						<Undo2 class="mt-px size-3 shrink-0" aria-hidden="true" />
						<span>{first.inverseSummary}</span>
					</p>
				{/if}
			</div>

			<div class="border-border flex items-center justify-end gap-2 border-t border-solid px-5 py-4">
				<button
					type="button"
					onclick={isBatch ? onCancelAll : onReject}
					use:focusOnMount
					class="border-border bg-background text-foreground hover:bg-muted focus-visible:ring-ring inline-flex h-9 cursor-pointer items-center rounded-md border border-solid px-4 text-sm transition-colors focus:outline-none focus-visible:ring-2"
				>
					{isBatch ? "Reject all" : "Reject"}
				</button>
				<button
					type="button"
					onclick={isBatch ? onApplyAll : onConfirm}
					class="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex h-9 cursor-pointer items-center rounded-md px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2"
				>
					{isBatch ? "Apply selected" : "Confirm"}
				</button>
			</div>
		</div>
	</div>
{/if}
