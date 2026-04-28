<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import { MONTHS } from "$lib/invoice/months";
	import type { InvoiceEntry, MonthName } from "$lib/types";
	import Input from "$lib/components/ui/input.svelte";
	import { Trash2 } from "@lucide/svelte";

	let { clientId, entry }: { clientId: string; entry: InvoiceEntry } = $props();
</script>

<div class="grid grid-cols-[1fr_80px_80px_32px] gap-2 items-center">
	<select
		value={entry.month}
		onchange={e =>
			session.updateInvoiceEntry(
				clientId,
				entry.id,
				"month",
				(e.currentTarget as HTMLSelectElement).value as MonthName
			)}
		class="h-9 rounded-xl border border-border bg-input px-3 text-sm text-foreground
               focus-visible:outline-2 focus-visible:outline-ring transition-colors"
	>
		{#each MONTHS as month (month)}
			<option value={month}>{month}</option>
		{/each}
	</select>

	<Input
		type="text"
		inputmode="numeric"
		maxlength={2}
		placeholder="01"
		value={entry.issueDay}
		oninput={e =>
			session.updateInvoiceEntry(
				clientId,
				entry.id,
				"issueDay",
				(e.currentTarget as HTMLInputElement).value
			)}
		class="text-center tabular-nums"
	/>

	<Input
		type="text"
		inputmode="numeric"
		maxlength={2}
		placeholder="07"
		value={entry.dueDay}
		oninput={e =>
			session.updateInvoiceEntry(
				clientId,
				entry.id,
				"dueDay",
				(e.currentTarget as HTMLInputElement).value
			)}
		class="text-center tabular-nums"
	/>

	<button
		onclick={() => session.removeInvoiceEntry(clientId, entry.id)}
		class="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground
               hover:text-destructive hover:bg-destructive/10 transition-colors"
		aria-label="Remove entry"
	>
		<Trash2 size={14} />
	</button>
</div>
