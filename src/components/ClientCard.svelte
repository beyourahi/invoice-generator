<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import type { Client, Currency, PaymentMethod } from "$lib/types";
	import { cn } from "$lib/utils";
	import Button from "$lib/components/ui/button.svelte";
	import Input from "$lib/components/ui/input.svelte";
	import Textarea from "$lib/components/ui/textarea.svelte";
	import Separator from "$lib/components/ui/separator.svelte";
	import { Card, CardContent, CardHeader } from "$lib/components/ui/card";
	import * as Field from "$lib/components/ui/field";
	import * as Select from "$lib/components/ui/select";
	import * as Table from "$lib/components/ui/table";
	import InvoiceEntryRow from "$src/components/InvoiceEntryRow.svelte";
	import { ChevronDown, Landmark, Plus, ReceiptText, Trash2 } from "@lucide/svelte";
	import { z } from "zod";

	let {
		client,
		index,
		selected,
		onSelect
	}: { client: Client; index: number; selected: boolean; onSelect: () => void } = $props();

	let expanded = $state(true);
	let nameTouched = $state(false);
	let prefixTouched = $state(false);
	let emailTouched = $state(false);
	let wiseTouched = $state(false);

	const nameSchema = z.string().trim().min(1, "Client name is required.");
	const prefixSchema = z.string().trim().min(1, "Invoice prefix is required.");
	const optionalEmailSchema = z.union([z.literal(""), z.string().trim().email("Enter a valid client email.")]);
	const optionalUrlSchema = z.union([z.literal(""), z.string().trim().url("Enter a valid Wise URL.")]);
	const update = (updater: (c: Client) => Client) => session.updateClient(client.id, updater);
	const set = <K extends keyof Client>(key: K, value: Client[K]) => update(c => ({ ...c, [key]: value }));
	const valueFromInput = (e: Event) => (e.currentTarget as HTMLInputElement).value;
	const valueFromTextArea = (e: Event) => (e.currentTarget as HTMLTextAreaElement).value;
	const selectCard = (e: KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") onSelect();
	};

	const totalAmount = $derived(
		`${client.service.currency === "BDT" ? "৳" : "$"}${client.service.amount.toLocaleString("en-US")}`
	);
	const nameError = $derived(
		nameTouched && !nameSchema.safeParse(client.name).success ? "Client name is required." : ""
	);
	const prefixError = $derived(
		prefixTouched && !prefixSchema.safeParse(client.invoicePrefix).success ? "Invoice prefix is required." : ""
	);
	const emailError = $derived(
		emailTouched && !optionalEmailSchema.safeParse(client.email).success ? "Enter a valid client email." : ""
	);
	const wiseLink = $derived(client.payment.wiseLink ?? "");
	const wiseError = $derived(
		wiseTouched && client.payment.method === "wise" && !optionalUrlSchema.safeParse(wiseLink).success
			? "Enter a valid Wise URL."
			: ""
	);
	const badgeNum = $derived(String(index + 1).padStart(2, "0"));
</script>

<Card class={cn("py-0", selected && "ring-brand ring-2")}>
	<CardHeader class="px-0 py-0">
		<div
			role="button"
			tabindex="0"
			aria-pressed={selected}
			onclick={onSelect}
			onkeydown={selectCard}
			class="hover:bg-accent/40 flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors"
		>
			<span class="text-brand w-6 shrink-0 font-mono text-[11px] tabular-nums">{badgeNum}</span>
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-medium">{client.name || "New client"}</p>
				<p class="text-muted-foreground truncate text-xs">
					{client.invoicePrefix || "No prefix"} · {client.invoices.length} scheduled
				</p>
			</div>
			<div class="hidden shrink-0 items-center gap-1.5 sm:flex">
				<span class="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-[10px]">
					{client.service.currency}
				</span>
				<span class="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-[10px]">
					{client.payment.method}
				</span>
			</div>
			<Button
				variant="ghost"
				size="icon-sm"
				class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-11 w-11 shrink-0 sm:h-7 sm:w-7"
				onclick={e => {
					e.stopPropagation();
					session.removeClient(client.id);
				}}
				aria-label="Remove client"
			>
				<Trash2 size={12} />
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				class="text-muted-foreground hover:text-foreground h-11 w-11 shrink-0 sm:h-7 sm:w-7"
				onclick={e => {
					e.stopPropagation();
					expanded = !expanded;
				}}
				aria-label={expanded ? "Collapse client" : "Expand client"}
			>
				<ChevronDown size={14} class={cn("transition-transform duration-200", expanded && "rotate-180")} />
			</Button>
		</div>
	</CardHeader>

	{#if expanded}
		<CardContent class="border-border space-y-5 border-t pb-4">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<Field.Field class="gap-1.5" data-invalid={nameError !== ""}>
					<Field.FieldLabel for="name-{client.id}">Client name</Field.FieldLabel>
					<Input
						id="name-{client.id}"
						placeholder="Acme Corp"
						value={client.name}
						aria-invalid={nameError !== ""}
						oninput={e => set("name", valueFromInput(e))}
						onblur={() => (nameTouched = true)}
						class={nameError ? "border-destructive focus-visible:border-destructive" : ""}
					/>
					{#if nameError}
						<Field.FieldError>{nameError}</Field.FieldError>
					{/if}
				</Field.Field>
				<Field.Field class="gap-1.5" data-invalid={prefixError !== ""}>
					<Field.FieldLabel for="prefix-{client.id}">Invoice prefix</Field.FieldLabel>
					<Input
						id="prefix-{client.id}"
						placeholder="ACME"
						value={client.invoicePrefix}
						aria-invalid={prefixError !== ""}
						oninput={e => set("invoicePrefix", valueFromInput(e))}
						onblur={() => (prefixTouched = true)}
						class={prefixError ? "border-destructive focus-visible:border-destructive" : ""}
					/>
					{#if prefixError}
						<Field.FieldError>{prefixError}</Field.FieldError>
					{/if}
				</Field.Field>
				<Field.Field class="gap-1.5">
					<Field.FieldLabel for="phone-{client.id}">Phone</Field.FieldLabel>
					<Input
						id="phone-{client.id}"
						type="tel"
						placeholder="+880..."
						value={client.phone}
						oninput={e => set("phone", valueFromInput(e))}
					/>
				</Field.Field>
				<Field.Field class="gap-1.5" data-invalid={emailError !== ""}>
					<Field.FieldLabel for="email-{client.id}">Email</Field.FieldLabel>
					<Input
						id="email-{client.id}"
						type="email"
						placeholder="hello@client.com"
						value={client.email}
						aria-invalid={emailError !== ""}
						oninput={e => set("email", valueFromInput(e))}
						onblur={() => (emailTouched = true)}
						class={emailError ? "border-destructive focus-visible:border-destructive" : ""}
					/>
					{#if emailError}
						<Field.FieldError>{emailError}</Field.FieldError>
					{/if}
				</Field.Field>
				<Field.Field class="gap-1.5 sm:col-span-2">
					<Field.FieldLabel for="address-{client.id}">Address</Field.FieldLabel>
					<Textarea
						id="address-{client.id}"
						placeholder="City, Country"
						value={client.address[0] ?? ""}
						oninput={e =>
							update(c => ({
								...c,
								address: [valueFromTextArea(e)]
							}))}
					/>
				</Field.Field>
			</div>

			<Separator />

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<Field.Field class="gap-1.5 sm:col-span-2">
					<Field.FieldLabel for="desc-{client.id}">Service description</Field.FieldLabel>
					<Textarea
						id="desc-{client.id}"
						placeholder="E-commerce storefront {'{MONTH}'} fee"
						value={client.service.description}
						oninput={e =>
							update(c => ({
								...c,
								service: {
									...c.service,
									description: valueFromTextArea(e)
								}
							}))}
					/>
				</Field.Field>
				<Field.Field class="gap-1.5">
					<Field.FieldLabel for="amount-{client.id}">Amount</Field.FieldLabel>
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
									amount: parseFloat(valueFromInput(e)) || 0
								}
							}))}
						class="tabular-nums"
					/>
				</Field.Field>
				<Field.Field class="gap-1.5">
					<Field.FieldLabel for="currency-{client.id}">Currency</Field.FieldLabel>
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
				</Field.Field>
			</div>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<Field.Field class="gap-1.5">
					<Field.FieldLabel for="payment-{client.id}">Payment method</Field.FieldLabel>
					<Select.Root
						type="single"
						value={client.payment.method}
						onValueChange={v =>
							update(c => ({ ...c, payment: { ...c.payment, method: v as PaymentMethod } }))}
					>
						<Select.Trigger id="payment-{client.id}" class="h-9 w-full">
							<span data-slot="select-value">
								{client.payment.method === "bank" ? "Bank transfer" : "Wise"}
							</span>
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="bank" label="Bank transfer">Bank transfer</Select.Item>
							<Select.Item value="wise" label="Wise">Wise</Select.Item>
						</Select.Content>
					</Select.Root>
				</Field.Field>
				<Field.Field class="gap-1.5">
					<Field.FieldLabel for="year-{client.id}">Year</Field.FieldLabel>
					<Input
						id="year-{client.id}"
						type="number"
						min="2020"
						max="2099"
						value={String(client.year)}
						oninput={e =>
							update(c => ({
								...c,
								year: parseInt(valueFromInput(e)) || new Date().getFullYear()
							}))}
						class="tabular-nums"
					/>
				</Field.Field>
				{#if client.payment.method === "wise"}
					<Field.Field class="gap-1.5 sm:col-span-2" data-invalid={wiseError !== ""}>
						<Field.FieldLabel for="wise-{client.id}">Wise payment link</Field.FieldLabel>
						<Input
							id="wise-{client.id}"
							type="url"
							placeholder="https://wise.com/pay/..."
							value={wiseLink}
							aria-invalid={wiseError !== ""}
							oninput={e =>
								update(c => ({
									...c,
									payment: {
										...c.payment,
										wiseLink: valueFromInput(e) || null
									}
								}))}
							onblur={() => (wiseTouched = true)}
							class={wiseError ? "border-destructive focus-visible:border-destructive" : ""}
						/>
						{#if wiseError}
							<Field.FieldError>{wiseError}</Field.FieldError>
						{/if}
					</Field.Field>
				{/if}
			</div>

			<Separator />

			<div class="space-y-3">
				<div class="flex items-center justify-between gap-3">
					<div class="flex items-center gap-2">
						<ReceiptText size={14} class="text-muted-foreground" />
						<p class="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
							Invoice schedule
						</p>
					</div>
					{#if client.invoices.length > 0}
						<p class="text-muted-foreground text-xs">{client.invoices.length} rows</p>
					{/if}
				</div>

				{#if client.invoices.length === 0}
					<div class="border-border text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-xs">
						No invoice months scheduled.
					</div>
				{:else}
					<Table.Root>
						<Table.Header>
							<Table.Row class="border-border hover:bg-transparent">
								<Table.Head class="h-8 pl-0 text-[10px] tracking-wider uppercase">Month</Table.Head>
								<Table.Head class="h-8 w-[72px] text-center text-[10px] tracking-wider uppercase">
									Issue
								</Table.Head>
								<Table.Head class="h-8 w-[72px] text-center text-[10px] tracking-wider uppercase">
									Due
								</Table.Head>
								<Table.Head class="h-8 w-8"></Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each client.invoices as entry (entry.id)}
								<InvoiceEntryRow clientId={client.id} {entry} />
							{/each}
						</Table.Body>
					</Table.Root>
				{/if}

				<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<Button
						variant="outline"
						size="sm"
						class="h-11 w-full border-dashed sm:h-7 sm:w-auto"
						onclick={() => session.addInvoiceEntry(client.id)}
					>
						<Plus size={12} />
						Add entry
					</Button>
					{#if client.invoices.length > 0}
						<div class="text-muted-foreground flex items-center justify-between gap-3 text-xs">
							<span>{client.invoices.length} invoice{client.invoices.length !== 1 ? "s" : ""}</span>
							<span class="font-mono tabular-nums">{totalAmount} × {client.invoices.length}</span>
						</div>
					{/if}
				</div>
			</div>

			{#if client.payment.method === "bank"}
				<div class="bg-brand-muted text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-xs">
					<Landmark size={13} />
					Bank details come from the sender panel.
				</div>
			{/if}
		</CardContent>
	{/if}
</Card>
