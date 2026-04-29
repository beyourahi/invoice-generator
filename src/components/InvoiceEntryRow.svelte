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
</script>

<Table.Row class="border-0 hover:bg-transparent">
	<Table.Cell class="py-1 pr-2 pl-0">
		<Select.Root
			type="single"
			value={entry.month}
			onValueChange={v => session.updateInvoiceEntry(clientId, entry.id, "month", v as MonthName)}
		>
			<Select.Trigger class="h-8 w-full text-xs">
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
			type="text"
			inputmode="numeric"
			maxlength={2}
			placeholder="01"
			value={entry.issueDay}
			oninput={e =>
				session.updateInvoiceEntry(clientId, entry.id, "issueDay", (e.currentTarget as HTMLInputElement).value)}
			class="h-8 text-center text-xs tabular-nums"
		/>
	</Table.Cell>
	<Table.Cell class="w-[72px] px-1 py-1">
		<Input
			type="text"
			inputmode="numeric"
			maxlength={2}
			placeholder="07"
			value={entry.dueDay}
			oninput={e =>
				session.updateInvoiceEntry(clientId, entry.id, "dueDay", (e.currentTarget as HTMLInputElement).value)}
			class="h-8 text-center text-xs tabular-nums"
		/>
	</Table.Cell>
	<Table.Cell class="w-8 px-0 py-1">
		<Button
			variant="ghost"
			size="icon"
			class="text-muted-foreground/30 hover:bg-destructive/10 hover:text-destructive h-8 w-8"
			onclick={() => session.removeInvoiceEntry(clientId, entry.id)}
			aria-label="Remove entry"
		>
			<Trash2 size={12} />
		</Button>
	</Table.Cell>
</Table.Row>
