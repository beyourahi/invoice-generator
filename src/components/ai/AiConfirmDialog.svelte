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
	import { ShieldCheck } from "@lucide/svelte";

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
			<AlertDialogTitle class="flex items-center gap-2">
				<ShieldCheck class="size-4 text-yellow-300" aria-hidden="true" />
				{isBatch ? `Confirm ${ai.pendingConfirmations.length} operations` : "Confirm operation"}
			</AlertDialogTitle>
			{#if first}
				<AlertDialogDescription>
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
								</div>
							</div>
						</li>
					{/each}
				</ul>
				<p class="text-muted-foreground text-xs">
					{ai.pendingConfirmations.length - rejected.size} will run; {rejected.size} will be rejected.
				</p>
			{:else if first}
				<div class="bg-muted/30 border-border/50 rounded-md border p-3 text-xs">
					<div class="text-muted-foreground mb-1 font-mono text-[10px] tracking-wide uppercase">Tool</div>
					<div class="font-medium">{first.toolName}</div>
					<pre
						class="text-muted-foreground mt-2 max-h-32 overflow-auto font-mono text-[10px] leading-relaxed break-all whitespace-pre-wrap">{JSON.stringify(
							first.args,
							null,
							2
						)}</pre>
				</div>
				{#if first.anomalies.length > 0}
					<AiAnomalyWarning anomalies={first.anomalies} />
				{/if}
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
