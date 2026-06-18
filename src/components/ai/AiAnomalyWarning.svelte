<!-- Non-blocking monochrome list of detected anomalies; renders nothing when there are none. -->
<script lang="ts">
	import type { AnomalyResult } from "$lib/ai/types";
	import { AlertTriangle } from "@lucide/svelte";

	let { anomalies }: { anomalies: AnomalyResult[] } = $props();
</script>

{#if anomalies.length > 0}
	<div class="border-hair bg-ink-2 text-chat-text-secondary rounded-md border p-3 text-xs">
		<div
			class="text-chat-text-primary mb-1.5 flex items-center gap-1.5 font-mono text-[11px] tracking-[0.18em] uppercase"
		>
			<AlertTriangle class="size-3.5 shrink-0" aria-hidden="true" />
			<span class="whitespace-nowrap">Safety check</span>
		</div>
		<ul class="space-y-1 pl-5 [list-style:disc]">
			{#each anomalies as anomaly, i (i)}
				<li class="text-pretty">{anomaly.reason}</li>
			{/each}
		</ul>
	</div>
{/if}
