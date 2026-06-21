<!--
	One invoice schedule entry (month + issue/due day + active toggle). Renders as a table
	row at sm+ (`as="row"`) or a stacked card on mobile (`as="card"`).
-->
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
	import { fade } from "svelte/transition";
	import { motionDuration } from "$lib/motion";
	import { Trash2 } from "@lucide/svelte";

	let {
		clientId,
		clientActive,
		entry,
		as = "row"
	}: { clientId: string; clientActive: boolean; entry: InvoiceEntry; as?: "row" | "card" } = $props();

	// inactive = visually dimmed (either gate off). suppressed = client off, so the entry's own
	// toggle is disabled (can't activate an entry under an inactive client) with an explanatory tooltip.
	const inactive = $derived(!clientActive || !entry.isActive);
	const suppressed = $derived(!clientActive);
	const switchTone =
		"data-[state=checked]:bg-status-active-track data-[state=unchecked]:bg-status-inactive-track status-transition";

	// Strip non-digits and write back to the DOM value so the field never shows rejected chars.
	const handleNumericInput = (field: "issueDay" | "dueDay", e: Event) => {
		const target = e.currentTarget as HTMLInputElement;
		const filtered = target.value.replace(/\D/g, "");
		if (target.value !== filtered) target.value = filtered;
		session.updateInvoiceEntry(clientId, entry.id, field, filtered);
	};
</script>

{#snippet activeSwitch(size: "sm" | "default")}
	{#if suppressed}
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger
					class="inline-flex cursor-not-allowed items-center justify-center"
					aria-label="Client is inactive — all invoices suppressed"
				>
					<Switch
						{size}
						checked={entry.isActive}
						disabled
						aria-label="Invoice toggle disabled"
						class={cn(switchTone, "cursor-not-allowed opacity-60")}
					/>
				</Tooltip.Trigger>
				<Tooltip.Content side="left" class="text-caption">
					Client is inactive — all invoices suppressed
				</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	{:else}
		<Switch
			{size}
			checked={entry.isActive}
			onCheckedChange={v => session.setInvoiceActive(clientId, entry.id, v)}
			aria-label={entry.isActive ? "Deactivate invoice" : "Activate invoice"}
			class={switchTone}
		/>
	{/if}
{/snippet}

{#if as === "row"}
	<Table.Row
		class={cn(
			"status-transition border-0 pointer-fine:hover:bg-transparent",
			inactive && "bg-status-inactive-bg opacity-80"
		)}
	>
		<Table.Cell
			class={cn(
				"status-transition relative py-1 pr-2 pl-0",
				inactive &&
					"before:bg-status-inactive-border before:absolute before:top-1.5 before:bottom-1.5 before:-left-1 before:w-[3px] before:rounded-full"
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
				id="issue-{entry.id}"
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
				id="due-{entry.id}"
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
			<div class="inline-flex items-center justify-center">
				{@render activeSwitch("sm")}
			</div>
		</Table.Cell>
		<Table.Cell class="w-11 px-0 py-1 sm:w-8">
			<Button
				variant="ghost"
				size="icon"
				class="text-muted-foreground pointer-fine:hover:bg-destructive/10 pointer-fine:hover:text-destructive h-11 w-11 sm:h-9 sm:w-9"
				onclick={() => session.removeInvoiceEntry(clientId, entry.id)}
				aria-label="Remove entry"
			>
				<Trash2 size={12} aria-hidden="true" />
			</Button>
		</Table.Cell>
	</Table.Row>
{:else}
	<div
		class={cn(
			"border-hair bg-card status-transition relative space-y-2.5 rounded-xl border p-3",
			inactive &&
				"bg-status-inactive-bg before:bg-status-inactive-border opacity-80 before:absolute before:top-2 before:bottom-2 before:left-0 before:w-[3px] before:rounded-full"
		)}
		transition:fade={{ duration: motionDuration("fast") }}
	>
		<div class="flex items-start gap-2">
			<div class="min-w-0 flex-1">
				<SelectDialog
					value={entry.month}
					title="Month"
					columns={3}
					options={MONTHS.map(m => ({ value: m, label: m }))}
					onSelect={v => session.updateInvoiceEntry(clientId, entry.id, "month", v as MonthName)}
					class="h-10 text-sm"
				/>
			</div>
			<Button
				variant="ghost"
				size="icon"
				class="text-muted-foreground pointer-fine:hover:bg-destructive/10 pointer-fine:hover:text-destructive h-10 w-10 shrink-0"
				onclick={() => session.removeInvoiceEntry(clientId, entry.id)}
				aria-label="Remove entry"
			>
				<Trash2 size={14} aria-hidden="true" />
			</Button>
		</div>
		<div class="grid grid-cols-3 gap-2">
			<div class="space-y-1">
				<label
					for="issue-{entry.id}"
					class="text-ink-muted text-micro block font-mono tracking-[0.12em] uppercase"
				>
					Issue
				</label>
				<Input
					id="issue-{entry.id}"
					type="tel"
					inputmode="numeric"
					pattern="[0-9]*"
					maxlength={2}
					placeholder="01"
					value={entry.issueDay}
					oninput={e => handleNumericInput("issueDay", e)}
					class="h-10 text-center text-sm tabular-nums"
				/>
			</div>
			<div class="space-y-1">
				<label
					for="due-{entry.id}"
					class="text-ink-muted text-micro block font-mono tracking-[0.12em] uppercase"
				>
					Due
				</label>
				<Input
					id="due-{entry.id}"
					type="tel"
					inputmode="numeric"
					pattern="[0-9]*"
					maxlength={2}
					placeholder="07"
					value={entry.dueDay}
					oninput={e => handleNumericInput("dueDay", e)}
					class="h-10 text-center text-sm tabular-nums"
				/>
			</div>
			<div class="space-y-1">
				<span class="text-ink-muted text-micro block font-mono tracking-[0.12em] uppercase"> Active </span>
				<div class="flex h-10 items-center justify-center">
					{@render activeSwitch("default")}
				</div>
			</div>
		</div>
	</div>
{/if}
