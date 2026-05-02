<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import { MONTHS } from "$lib/invoice/months";
	import type { InvoiceEntry, MonthName } from "$lib/types";
	import Input from "$lib/components/ui/input.svelte";
	import Button from "$lib/components/ui/button.svelte";
	import * as Select from "$lib/components/ui/select";
	import * as Table from "$lib/components/ui/table";
	import { Trash2 } from "@lucide/svelte";

	let { clientId, entry }: { clientId: string; entry: InvoiceEntry } = $props();

	const handleNumericInput = (field: "issueDay" | "dueDay", e: Event) => {
		const target = e.currentTarget as HTMLInputElement;
		const filtered = target.value.replace(/\D/g, "");
		if (target.value !== filtered) target.value = filtered;
		session.updateInvoiceEntry(clientId, entry.id, field, filtered);
	};
</script>

<Table.Row class="border-0 hover:bg-transparent">
	<Table.Cell class="py-1 pr-2 pl-0">
		<Select.Root
			type="single"
			value={entry.month}
			onValueChange={v => session.updateInvoiceEntry(clientId, entry.id, "month", v as MonthName)}
		>
			<Select.Trigger class="h-11 w-full text-xs sm:h-8">
				<span data-slot="select-value">{entry.month}</span>
			</Select.Trigger>
			<Select.Content>
				{#each MONTHS as month (month)}
					<Select.Item value={month} label={month} class="text-xs">{month}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</Table.Cell>
	<Table.Cell class="w-[72px] px-1 py-1">
		<Input
			type="tel"
			inputmode="numeric"
			pattern="[0-9]*"
			maxlength={2}
			placeholder="01"
			value={entry.issueDay}
			oninput={e => handleNumericInput("issueDay", e)}
			class="h-11 text-center text-xs tabular-nums sm:h-8"
		/>
	</Table.Cell>
	<Table.Cell class="w-[72px] px-1 py-1">
		<Input
			type="tel"
			inputmode="numeric"
			pattern="[0-9]*"
			maxlength={2}
			placeholder="07"
			value={entry.dueDay}
			oninput={e => handleNumericInput("dueDay", e)}
			class="h-11 text-center text-xs tabular-nums sm:h-8"
		/>
	</Table.Cell>
	<Table.Cell class="w-11 px-0 py-1 sm:w-8">
		<Button
			variant="ghost"
			size="icon"
			class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-11 w-11 sm:h-9 sm:w-9"
			onclick={() => session.removeInvoiceEntry(clientId, entry.id)}
			aria-label="Remove entry"
		>
			<Trash2 size={12} aria-hidden="true" />
		</Button>
	</Table.Cell>
</Table.Row>
