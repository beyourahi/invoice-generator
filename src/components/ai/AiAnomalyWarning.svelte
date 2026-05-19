<script lang="ts">
	import type { AnomalyResult } from "$lib/ai/types";
	import { AlertTriangle } from "@lucide/svelte";

	let { anomalies }: { anomalies: AnomalyResult[] } = $props();
</script>

{#if anomalies.length > 0}
	<div class="border-yellow-500/30 bg-yellow-500/10 text-yellow-300 rounded-md border p-3 text-xs">
		<div class="mb-1 flex items-center gap-1.5 font-semibold">
			<AlertTriangle class="size-3.5" aria-hidden="true" />
			Safety check
		</div>
		<ul class="space-y-1 pl-5 [list-style:disc]">
			{#each anomalies as anomaly, i (i)}
				<li class="opacity-90">{anomaly.reason}</li>
			{/each}
		</ul>
	</div>
{/if}
