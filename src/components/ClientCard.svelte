<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import type { Client } from "$lib/types";
	import { cn } from "$lib/utils";
	import Input from "$lib/components/ui/input.svelte";
	import Label from "$lib/components/ui/label.svelte";
	import Separator from "$lib/components/ui/separator.svelte";
	import { Card } from "$lib/components/ui/card";
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

<Card class={cn("py-0", selected && "ring-2 ring-brand/50")}>
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
		<button
			onclick={e => {
				e.stopPropagation();
				session.removeClient(client.id);
			}}
			class="text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors"
			aria-label="Remove client"
		>
			<Trash2 size={11} />
		</button>
		<button
			onclick={e => {
				e.stopPropagation();
				expanded = !expanded;
			}}
			class="text-muted-foreground/40 hover:text-foreground flex h-6 w-6 shrink-0 items-center justify-center transition-colors"
			aria-label={expanded ? "Collapse" : "Expand"}
		>
			<ChevronDown size={13} class="transition-transform duration-200 {expanded ? 'rotate-180' : ''}" />
		</button>
	</div>

	{#if expanded}
		<div class="border-border/40 space-y-4 border-t px-4 pb-4 pt-4">
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
					<select
						id="currency-{client.id}"
						value={client.service.currency}
						onchange={e =>
							update(c => ({
								...c,
								service: {
									...c.service,
									currency: (e.currentTarget as HTMLSelectElement).value as "BDT" | "USD"
								}
							}))}
						class="border-border bg-input text-foreground focus-visible:outline-ring h-9 w-full rounded-xl border px-3 text-sm transition-colors focus-visible:outline-2"
					>
						<option value="BDT">BDT (৳)</option>
						<option value="USD">USD ($)</option>
					</select>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div>
					<Label for="payment-{client.id}">payment method</Label>
					<select
						id="payment-{client.id}"
						value={client.payment.method}
						onchange={e =>
							update(c => ({
								...c,
								payment: {
									...c.payment,
									method: (e.currentTarget as HTMLSelectElement).value as "bank" | "wise"
								}
							}))}
						class="border-border bg-input text-foreground focus-visible:outline-ring h-9 w-full rounded-xl border px-3 text-sm transition-colors focus-visible:outline-2"
					>
						<option value="bank">Bank Transfer</option>
						<option value="wise">Wise</option>
					</select>
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

			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<span class="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
						Invoice Schedule
						{#if client.invoices.length > 0}
							<span class="text-foreground/40 ml-1.5 tracking-normal normal-case">
								({client.invoices.length})
							</span>
						{/if}
					</span>
					<div class="text-muted-foreground/40 flex items-center gap-2 pr-8 text-[11px]">
						<span class="w-[72px] text-center">issue</span>
						<span class="w-[72px] text-center">due</span>
					</div>
				</div>

				{#if client.invoices.length === 0}
					<p class="text-muted-foreground/40 py-1 text-xs">no entries yet</p>
				{:else}
					<div class="space-y-1.5">
						{#each client.invoices as entry (entry.id)}
							<InvoiceEntryRow clientId={client.id} {entry} />
						{/each}
					</div>
				{/if}

				<button
					onclick={() => session.addInvoiceEntry(client.id)}
					class="text-muted-foreground/50 hover:text-foreground flex items-center gap-1.5 py-0.5 text-xs transition-colors"
				>
					<Plus size={11} />
					add entry
				</button>
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
