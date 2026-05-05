<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog";
	import Button from "$lib/components/ui/button.svelte";
	import { cn } from "$lib/utils";
	import { MONTHS } from "$lib/invoice/months";
	import type { MonthName } from "$lib/types";
	import { Check, Loader2, Plus } from "@lucide/svelte";

	let {
		scheduledMonths = [],
		onConfirm,
		disabled = false,
		variant = "default"
	}: {
		scheduledMonths: MonthName[];
		onConfirm: (months: MonthName[]) => Promise<void>;
		disabled?: boolean;
		variant?: "empty" | "default";
	} = $props();

	let open = $state(false);
	let pending = $state<MonthName[]>([]);
	let loading = $state(false);

	const toggleMonth = (month: MonthName) => {
		if (scheduledMonths.includes(month)) return;
		pending = pending.includes(month) ? pending.filter(m => m !== month) : [...pending, month];
	};

	const confirm = async () => {
		loading = true;
		await onConfirm(pending);
		loading = false;
		open = false;
	};

	const MONTH_ABBR: Record<MonthName, string> = {
		January: "Jan",
		February: "Feb",
		March: "Mar",
		April: "Apr",
		May: "May",
		June: "Jun",
		July: "Jul",
		August: "Aug",
		September: "Sep",
		October: "Oct",
		November: "Nov",
		December: "Dec"
	};
</script>

<Dialog.Root bind:open>
	{#if variant === "empty"}
		<Dialog.Trigger
			{disabled}
			onclick={() => (pending = [])}
			class="border-border hover:border-foreground/30 hover:bg-accent/30 h-auto min-h-20 w-full cursor-pointer rounded-lg border border-dashed transition-colors disabled:cursor-not-allowed disabled:opacity-50"
			aria-label="Add months"
		>
			<div class="flex flex-col items-center gap-2 py-3">
				<Plus size={16} aria-hidden="true" />
				<span class="text-sm font-medium">Add months</span>
			</div>
		</Dialog.Trigger>
	{:else}
		<Dialog.Trigger
			{disabled}
			onclick={() => (pending = [])}
			class="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
			aria-label="Add months"
		>
			<Plus size={14} aria-hidden="true" />
			Add months
		</Dialog.Trigger>
	{/if}

	<Dialog.Content
		class="data-open:slide-in-from-bottom-2 data-closed:slide-out-to-bottom-1 gap-0 p-0 sm:max-w-sm"
		showCloseButton={false}
	>
		<Dialog.Header class="border-border border-b px-4 py-3.5">
			<Dialog.Title class="text-left text-sm font-semibold">Add months</Dialog.Title>
			<Dialog.Description class="text-muted-foreground mt-0.5 text-left text-xs">
				Select months to schedule invoices for.
			</Dialog.Description>
		</Dialog.Header>

		<div class="grid grid-cols-4 gap-1.5 p-3">
			{#each MONTHS as month (month)}
				{@const isScheduled = scheduledMonths.includes(month)}
				{@const isSelected = pending.includes(month)}
				<button
					type="button"
					disabled={isScheduled}
					onclick={() => toggleMonth(month)}
					class={cn(
						"relative flex h-10 items-center justify-center rounded-md border text-sm font-medium transition-colors",
						isScheduled
							? "border-border text-muted-foreground cursor-not-allowed line-through opacity-30"
							: isSelected
								? "border-brand bg-brand/10 text-brand cursor-pointer"
								: "border-border hover:border-foreground/40 hover:bg-accent/40 cursor-pointer"
					)}
					aria-pressed={isSelected}
					aria-disabled={isScheduled}
				>
					{#if isSelected}
						<Check size={10} class="absolute top-1 right-1" aria-hidden="true" />
					{/if}
					{MONTH_ABBR[month]}
				</button>
			{/each}
		</div>

		<div class="border-border flex items-center justify-between border-t px-4 py-3">
			{#if pending.length > 0}
				<span class="text-muted-foreground text-xs">{pending.length} selected</span>
			{:else}
				<span></span>
			{/if}
			<div class="flex items-center gap-2">
				<Button variant="ghost" size="sm" onclick={() => (open = false)}>Cancel</Button>
				<Button size="sm" disabled={pending.length === 0 || loading} onclick={confirm}>
					{#if loading}
						<Loader2 size={14} class="animate-spin" aria-hidden="true" />
					{/if}
					Confirm
				</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
