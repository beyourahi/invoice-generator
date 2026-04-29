<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import type { Client } from "$lib/types";
	import type { Currency, PaymentMethod } from "$lib/types";
	import { cn } from "$lib/utils";
	import Input from "$lib/components/ui/input.svelte";
	import Label from "$lib/components/ui/label.svelte";
	import Separator from "$lib/components/ui/separator.svelte";
	import Button from "$lib/components/ui/button.svelte";
	import { Card } from "$lib/components/ui/card";
	import * as Select from "$lib/components/ui/select";
	import * as Table from "$lib/components/ui/table";
	import InvoiceEntryRow from "./InvoiceEntryRow.svelte";
	import { Plus, Trash2, ChevronDown } from "@lucide/svelte";

	let {
		client,
		index,
		selected,
		onSelect
	}: { client: Client; index: number; selected: boolean; onSelect: () => void } = $props();

	let expanded = $state(true);
	let nameTouched = $state(false);
	let prefixTouched = $state(false);

	const update = (updater: (c: Client) => Client) => session.updateClient(client.id, updater);
	const set = <K extends keyof Client>(key: K, value: Client[K]) => update(c => ({ ...c, [key]: value }));

	const totalAmount = $derived(
		`${client.service.currency === "BDT" ? "৳" : "$"}${client.service.amount.toLocaleString("en-US")}`
	);
	const nameInvalid = $derived(nameTouched && client.name.trim() === "");
	const prefixInvalid = $derived(prefixTouched && client.invoicePrefix.trim() === "");
	const badgeNum = $derived(String(index + 1).padStart(2, "0"));
</script>

<Card class={cn("py-0", selected && "ring-brand/50 ring-2")}>
	<!-- Header: click to select for preview -->
	<div
		role="button"
		tabindex="0"
		onclick={onSelect}
		onkeydown={e => e.key === "Enter" && onSelect()}
		class="hover:bg-accent/20 flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors"
	>
		<span class="text-brand w-5 shrink-0 font-mono text-[11px] tabular-nums">{badgeNum}</span>
		<span class="text-foreground/90 min-w-0 flex-1 truncate text-sm font-medium">
			{client.name || "new client"}
		</span>
		<div class="flex shrink-0 items-center gap-1.5">
			<span class="bg-muted/50 text-muted-foreground/60 rounded-md px-1.5 py-0.5 font-mono text-[10px]">
				{client.service.currency}
			</span>
			<span class="bg-muted/50 text-muted-foreground/60 rounded-md px-1.5 py-0.5 text-[10px]">
				{client.payment.method}
			</span>
		</div>
		<Button
			variant="ghost"
			size="icon"
			class="text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive h-6 w-6 shrink-0"
			onclick={e => {
				e.stopPropagation();
				session.removeClient(client.id);
			}}
			aria-label="Remove client"
		>
			<Trash2 size={11} />
		</Button>
		<Button
			variant="ghost"
			size="icon"
			class="text-muted-foreground/40 hover:text-foreground h-6 w-6 shrink-0"
			onclick={e => {
				e.stopPropagation();
				expanded = !expanded;
			}}
			aria-label={expanded ? "Collapse" : "Expand"}
		>
			<ChevronDown size={13} class="transition-transform duration-200 {expanded ? 'rotate-180' : ''}" />
		</Button>
	</div>

	{#if expanded}
		<div class="border-border/40 space-y-4 border-t px-4 pt-4 pb-4">
			<div class="grid grid-cols-2 gap-3">
				<div>
					<Label for="name-{client.id}">client name <span class="text-destructive">*</span></Label>
					<Input
						id="name-{client.id}"
						placeholder="Acme Corp"
						value={client.name}
						oninput={e => set("name", (e.currentTarget as HTMLInputElement).value)}
						onblur={() => (nameTouched = true)}
						class={nameInvalid ? "border-destructive focus-visible:border-destructive" : ""}
					/>
				</div>
				<div>
					<Label for="prefix-{client.id}">invoice prefix <span class="text-destructive">*</span></Label>
					<Input
						id="prefix-{client.id}"
						placeholder="ACME"
						value={client.invoicePrefix}
						oninput={e => set("invoicePrefix", (e.currentTarget as HTMLInputElement).value)}
						onblur={() => (prefixTouched = true)}
						class={prefixInvalid ? "border-destructive focus-visible:border-destructive" : ""}
					/>
				</div>
				<div>
					<Label for="phone-{client.id}">phone</Label>
					<Input
						id="phone-{client.id}"
						type="tel"
						placeholder="+880..."
						value={client.phone}
						oninput={e => set("phone", (e.currentTarget as HTMLInputElement).value)}
					/>
				</div>
				<div>
					<Label for="email-{client.id}">email</Label>
					<Input
						id="email-{client.id}"
						type="email"
						placeholder="hello@client.com"
						value={client.email}
						oninput={e => set("email", (e.currentTarget as HTMLInputElement).value)}
					/>
				</div>
				<div class="col-span-2">
					<Label for="address-{client.id}">address</Label>
					<Input
						id="address-{client.id}"
						placeholder="City, Country"
						value={client.address[0] ?? ""}
						oninput={e =>
							update(c => ({
								...c,
								address: [(e.currentTarget as HTMLInputElement).value]
							}))}
					/>
				</div>
			</div>

			<Separator />

			<div class="grid grid-cols-2 gap-3">
				<div class="col-span-2">
					<Label for="desc-{client.id}">service description</Label>
					<Input
						id="desc-{client.id}"
						placeholder="E-commerce Storefront {'{MONTH}'} Fee"
						value={client.service.description}
						oninput={e =>
							update(c => ({
								...c,
								service: {
									...c.service,
									description: (e.currentTarget as HTMLInputElement).value
								}
							}))}
					/>
				</div>
				<div>
					<Label for="amount-{client.id}">amount</Label>
					<Input
						id="amount-{client.id}"
						type="number"
						min="0"
						placeholder="0"
						value={String(client.service.amount)}
						oninput={e =>
							update(c => ({
								...c,
								service: {
									...c.service,
									amount: parseFloat((e.currentTarget as HTMLInputElement).value) || 0
								}
							}))}
						class="tabular-nums"
					/>
				</div>
				<div>
					<Label for="currency-{client.id}">currency</Label>
					<Select.Root
						type="single"
						value={client.service.currency}
						onValueChange={v => update(c => ({ ...c, service: { ...c.service, currency: v as Currency } }))}
					>
						<Select.Trigger id="currency-{client.id}" class="h-9 w-full">
							<span data-slot="select-value">
								{client.service.currency === "BDT" ? "BDT (৳)" : "USD ($)"}
							</span>
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="BDT" label="BDT (৳)">BDT (৳)</Select.Item>
							<Select.Item value="USD" label="USD ($)">USD ($)</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div>
					<Label for="payment-{client.id}">payment method</Label>
					<Select.Root
						type="single"
						value={client.payment.method}
						onValueChange={v =>
							update(c => ({ ...c, payment: { ...c.payment, method: v as PaymentMethod } }))}
					>
						<Select.Trigger id="payment-{client.id}" class="h-9 w-full">
							<span data-slot="select-value">
								{client.payment.method === "bank" ? "Bank Transfer" : "Wise"}
							</span>
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="bank" label="Bank Transfer">Bank Transfer</Select.Item>
							<Select.Item value="wise" label="Wise">Wise</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>
				<div>
					<Label for="year-{client.id}">year</Label>
					<Input
						id="year-{client.id}"
						type="number"
						min="2020"
						max="2099"
						value={String(client.year)}
						oninput={e =>
							update(c => ({
								...c,
								year: parseInt((e.currentTarget as HTMLInputElement).value) || new Date().getFullYear()
							}))}
						class="tabular-nums"
					/>
				</div>
				{#if client.payment.method === "wise"}
					<div class="col-span-2">
						<Label for="wise-{client.id}">wise payment link</Label>
						<Input
							id="wise-{client.id}"
							type="url"
							placeholder="https://wise.com/pay/..."
							value={client.payment.wiseLink ?? ""}
							oninput={e =>
								update(c => ({
									...c,
									payment: {
										...c.payment,
										wiseLink: (e.currentTarget as HTMLInputElement).value || null
									}
								}))}
						/>
					</div>
				{/if}
			</div>

			<Separator />

			<div class="space-y-1.5">
				<div class="flex items-center justify-between">
					<span class="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
						Invoice Schedule
						{#if client.invoices.length > 0}
							<span class="text-foreground/40 ml-1.5 tracking-normal normal-case">
								({client.invoices.length})
							</span>
						{/if}
					</span>
				</div>

				{#if client.invoices.length === 0}
					<p class="text-muted-foreground/40 py-1 text-xs">no entries yet</p>
				{:else}
					<Table.Root>
						<Table.Header>
							<Table.Row class="border-0 hover:bg-transparent">
								<Table.Head class="h-7 pl-0 text-[10px] tracking-wider uppercase">Month</Table.Head>
								<Table.Head class="h-7 w-[72px] text-center text-[10px] tracking-wider uppercase"
									>Issue</Table.Head
								>
								<Table.Head class="h-7 w-[72px] text-center text-[10px] tracking-wider uppercase"
									>Due</Table.Head
								>
								<Table.Head class="h-7 w-8"></Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each client.invoices as entry (entry.id)}
								<InvoiceEntryRow clientId={client.id} {entry} />
							{/each}
						</Table.Body>
					</Table.Root>
				{/if}

				<Button
					variant="ghost"
					size="sm"
					class="text-muted-foreground/50 hover:text-foreground h-7 px-2 text-xs"
					onclick={() => session.addInvoiceEntry(client.id)}
				>
					<Plus size={11} />
					add entry
				</Button>
			</div>

			{#if client.invoices.length > 0}
				<div class="text-muted-foreground/50 flex items-center justify-between pt-1 text-xs">
					<span>{client.invoices.length} invoice{client.invoices.length !== 1 ? "s" : ""}</span>
					<span class="font-mono tabular-nums">{totalAmount} × {client.invoices.length}</span>
				</div>
			{/if}
		</div>
	{/if}
</Card>
