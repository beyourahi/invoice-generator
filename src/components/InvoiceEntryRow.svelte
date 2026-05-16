<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import { MONTHS } from "$lib/invoice/months";
	import type { InvoiceEntry, MonthName } from "$lib/types";
	import { cn } from "$lib/utils";
	import Input from "$lib/components/ui/input.svelte";
	import Button from "$lib/components/ui/button.svelte";
	import * as Table from "$lib/components/ui/table";
	import * as Tooltip from "$lib/components/ui/tooltip";
	import { Switch } from "$lib/components/ui/switch";
	import SelectDialog from "$src/components/SelectDialog.svelte";
	import { Trash2 } from "@lucide/svelte";

	let { clientId, clientActive, entry }: { clientId: string; clientActive: boolean; entry: InvoiceEntry } = $props();

	const dimmed = $derived(!clientActive || !entry.isActive);
	const showAccent = $derived(!entry.isActive);

	const handleNumericInput = (field: "issueDay" | "dueDay", e: Event) => {
		const target = e.currentTarget as HTMLInputElement;
		const filtered = target.value.replace(/\D/g, "");
		if (target.value !== filtered) target.value = filtered;
		session.updateInvoiceEntry(clientId, entry.id, field, filtered);
	};
</script>

<Table.Row class={cn("border-0 transition-opacity hover:bg-transparent", dimmed && "opacity-75")}>
	<Table.Cell
		class={cn(
			"relative py-1 pr-2 pl-0",
			showAccent &&
				"before:bg-status-inactive/60 before:absolute before:top-1.5 before:bottom-1.5 before:-left-1 before:w-[2px] before:rounded-full"
		)}
	>
		<SelectDialog
			value={entry.month}
			title="Month"
			columns={3}
			options={MONTHS.map(m => ({ value: m, label: m }))}
			onSelect={v => session.updateInvoiceEntry(clientId, entry.id, "month", v as MonthName)}
			class="h-11 text-xs sm:h-8"
		/>
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
	<Table.Cell class="w-12 px-1 py-1 text-center">
		{#if clientActive}
			<div class="inline-flex items-center justify-center">
				<Switch
					size="sm"
					checked={entry.isActive}
					onCheckedChange={v => session.setInvoiceActive(clientId, entry.id, v)}
					aria-label={entry.isActive ? "Deactivate invoice" : "Activate invoice"}
				/>
			</div>
		{:else}
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger
						class="inline-flex items-center justify-center"
						aria-label="Client is inactive — all invoices suppressed"
					>
						<Switch size="sm" checked={entry.isActive} disabled aria-label="Invoice toggle disabled" />
					</Tooltip.Trigger>
					<Tooltip.Content side="left" class="text-[11px]">
						Client is inactive — all invoices suppressed
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		{/if}
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
