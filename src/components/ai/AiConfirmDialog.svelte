<script lang="ts">
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
	import { respondToConfirmation, respondToAllConfirmations } from "$lib/ai/chat-client";
	import AiAnomalyWarning from "./AiAnomalyWarning.svelte";
	import { ShieldCheck, Undo2 } from "@lucide/svelte";

	const open = $derived(ai.pendingConfirmations.length > 0);
	const first = $derived(ai.pendingConfirmations[0]);
	const isBatch = $derived(ai.pendingConfirmations.length > 1);

	const rejected = $state(new Set<string>());

	const onApplyAll = () => {
		for (const req of [...ai.pendingConfirmations]) {
			if (rejected.has(req.toolCallId)) {
				req.resolve(false);
			} else {
				req.resolve(true);
			}
		}
		rejected.clear();
	};

	const onCancelAll = () => {
		respondToAllConfirmations(false);
		rejected.clear();
	};

	const onToggleReject = (id: string) => {
		if (rejected.has(id)) {
			rejected.delete(id);
		} else {
			rejected.add(id);
		}
	};

	const onSingleApply = () => {
		if (first) respondToConfirmation(first.toolCallId, true);
	};

	const onSingleReject = () => {
		if (first) respondToConfirmation(first.toolCallId, false);
	};
</script>

<AlertDialog {open}>
	<AlertDialogContent
		onEscapeKeydown={e => e.preventDefault()}
		onInteractOutside={e => e.preventDefault()}
		class="max-w-md"
	>
		<AlertDialogHeader>
			<AlertDialogTitle class="flex items-center gap-2 text-balance">
				<ShieldCheck class="size-4 text-yellow-300" aria-hidden="true" />
				{isBatch ? `Confirm ${ai.pendingConfirmations.length} operations` : "Confirm operation"}
			</AlertDialogTitle>
			{#if first}
				<AlertDialogDescription class="text-pretty">
					{#if !isBatch}
						{first.humanLabel}.
					{:else}
						Review the proposed changes below. Toggle reject on any item to skip it.
					{/if}
				</AlertDialogDescription>
			{/if}
		</AlertDialogHeader>

		<div class="space-y-3">
			{#if isBatch}
				<ul class="border-border/60 max-h-72 space-y-2 overflow-y-auto rounded-md border p-2">
					{#each ai.pendingConfirmations as req (req.toolCallId)}
						<li class="border-border/40 bg-card/40 rounded-md border p-2 text-xs">
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
									<span class="text-muted-foreground font-mono text-[10px]">
										{req.toolName}
									</span>
									{#if req.anomalies.length > 0}
										<AiAnomalyWarning anomalies={req.anomalies} />
									{/if}
									<span class="text-muted-foreground/70 text-[10px] text-pretty">
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
			{:else if first}
				{#if first.diff.length > 0}
					<div class="border-border/50 bg-muted/20 space-y-2.5 rounded-md border p-3">
						{#each first.diff as row (row.label)}
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
									<span class="shrink-0 font-mono text-[var(--status-active-foreground)] select-none">
										+
									</span>
									<span class="text-foreground min-w-0 font-medium break-words">
										{row.proposed}
									</span>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="bg-muted/30 border-border/50 rounded-md border p-3 text-xs">
						<div
							class="text-muted-foreground mb-1 font-mono text-[10px] tracking-wide whitespace-nowrap uppercase"
						>
							Operation
						</div>
						<div class="font-medium text-balance">{first.humanLabel}</div>
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

		<AlertDialogFooter class="gap-2">
			{#if isBatch}
				<AlertDialogCancel onclick={onCancelAll}>Reject all</AlertDialogCancel>
				<AlertDialogAction onclick={onApplyAll}>Apply selected</AlertDialogAction>
			{:else}
				<AlertDialogCancel onclick={onSingleReject}>Reject</AlertDialogCancel>
				<AlertDialogAction onclick={onSingleApply}>Confirm</AlertDialogAction>
			{/if}
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
