<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import type { Client } from "$lib/types";
	import Input from "$lib/components/ui/input.svelte";
	import Label from "$lib/components/ui/label.svelte";
	import Badge from "$lib/components/ui/badge.svelte";
	import Separator from "$lib/components/ui/separator.svelte";
	import InvoiceEntryRow from "./InvoiceEntryRow.svelte";
	import { Plus, Trash2 } from "@lucide/svelte";
	import { onMount } from "svelte";
	import { gsap } from "gsap";

	let { client }: { client: Client } = $props();
	let cardEl: HTMLDivElement;
	let nameTouched = $state(false);
	let prefixTouched = $state(false);

	onMount(() => {
		gsap.from(cardEl, {
			opacity: 0,
			y: 16,
			duration: 0.35,
			ease: "power2.out"
		});
	});

	const update = (updater: (c: Client) => Client) => session.updateClient(client.id, updater);
	const set = <K extends keyof Client>(key: K, value: Client[K]) => update(c => ({ ...c, [key]: value }));

	const totalAmount = $derived(
		`${client.service.currency === "BDT" ? "৳" : "$"}${client.service.amount.toLocaleString("en-US")}`
	);

	const nameInvalid = $derived(nameTouched && client.name.trim() === "");
	const prefixInvalid = $derived(prefixTouched && client.invoicePrefix.trim() === "");
</script>

<div bind:this={cardEl} class="border-border/60 bg-card space-y-4 rounded-2xl border p-5">
	<div class="flex items-start justify-between gap-3">
		<div class="flex min-w-0 items-center gap-2">
			<span class="text-foreground truncate text-sm font-medium">
				{client.name || "new client"}
			</span>
			<Badge variant="secondary">{client.service.currency}</Badge>
			<Badge variant="outline">{client.payment.method}</Badge>
		</div>
		<button
			onclick={() => session.removeClient(client.id)}
			class="text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex h-7 w-7 shrink-0
                   items-center justify-center rounded-lg
                   transition-colors"
			aria-label="Remove client"
		>
			<Trash2 size={13} />
		</button>
	</div>

	<Separator />

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
				placeholder={"E-commerce Storefront {MONTH} Fee"}
				value={client.service.description}
				oninput={e =>
					update(c => ({
						...c,
						service: { ...c.service, description: (e.currentTarget as HTMLInputElement).value }
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
				class="border-border bg-input text-foreground focus-visible:outline-ring h-9 w-full rounded-xl border px-3
                       text-sm transition-colors focus-visible:outline-2"
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
				class="border-border bg-input text-foreground focus-visible:outline-ring h-9 w-full rounded-xl border px-3
                       text-sm transition-colors focus-visible:outline-2"
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
			<span class="text-muted-foreground text-xs font-medium tracking-wider uppercase">
				invoice schedule
				{#if client.invoices.length > 0}
					<span class="text-foreground/50 ml-1.5">({client.invoices.length})</span>
				{/if}
			</span>
			<div class="text-muted-foreground/60 flex items-center gap-2 pr-8 text-xs">
				<span class="w-[80px] text-center">issue day</span>
				<span class="w-[80px] text-center">due day</span>
			</div>
		</div>

		{#if client.invoices.length === 0}
			<p class="text-muted-foreground/50 py-2 text-xs">no invoice entries yet — add one below</p>
		{:else}
			<div class="space-y-2">
				{#each client.invoices as entry (entry.id)}
					<InvoiceEntryRow clientId={client.id} {entry} />
				{/each}
			</div>
		{/if}

		<button
			onclick={() => session.addInvoiceEntry(client.id)}
			class="text-muted-foreground hover:text-foreground flex items-center gap-1.5 py-1
                   text-xs transition-colors"
		>
			<Plus size={12} />
			add invoice entry
		</button>
	</div>

	{#if client.invoices.length > 0}
		<div class="text-muted-foreground/60 flex items-center justify-between pt-1 text-xs">
			<span>{client.invoices.length} invoice{client.invoices.length !== 1 ? "s" : ""}</span>
			<span class="tabular-nums">{totalAmount} × {client.invoices.length}</span>
		</div>
	{/if}
</div>
