<script lang="ts">
	import { tick } from "svelte";
	import { fixed } from "$lib/stores/fixed.svelte";
	import { PAYMENT_METHOD_KINDS, getMethodDef } from "$lib/payments/registry";
	import type { PaymentMethodKind } from "$lib/types";
	import Input from "$lib/components/ui/input.svelte";
	import Textarea from "$lib/components/ui/textarea.svelte";
	import { Separator } from "$lib/components/ui/separator";
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "$lib/components/ui/card";
	import * as Field from "$lib/components/ui/field";
	import * as Select from "$lib/components/ui/select";
	import PaymentMethodCard from "$src/components/PaymentMethodCard.svelte";
	import { UserRound, Wallet } from "@lucide/svelte";
	import { z } from "zod";

	let emailTouched = $state(false);
	let expandedMethodId = $state<string | null>(null);
	let pendingKind = $state<PaymentMethodKind | null>(null);
	let pickerValue = $state<string>("");

	const optionalEmailSchema = z.union([z.literal(""), z.string().trim().email("Enter a valid sender email.")]);
	const senderEmailError = $derived(
		emailTouched && !optionalEmailSchema.safeParse(fixed.value.from.email).success
			? "Enter a valid sender email."
			: ""
	);
	const valueFromInput = (e: Event) => (e.currentTarget as HTMLInputElement).value;
	const valueFromTextArea = (e: Event) => (e.currentTarget as HTMLTextAreaElement).value;

	const methods = $derived(fixed.value.paymentMethods);

	const focusMethodCard = async (id: string) => {
		expandedMethodId = id;
		await tick();
		const node = document.getElementById(`method-panel-${id}`) ?? document.getElementById(`method-row-${id}`);
		node?.scrollIntoView({ behavior: "smooth", block: "nearest" });
	};

	const handlePickerChange = async (raw: string) => {
		const kind = (raw || null) as PaymentMethodKind | null;
		pickerValue = "";
		if (!kind || pendingKind) return;
		const existing = fixed.value.paymentMethods.find(m => m.kind === kind);
		if (existing) {
			await focusMethodCard(existing.id);
			return;
		}
		pendingKind = kind;
		const newId = await fixed.addPaymentMethod(kind);
		pendingKind = null;
		if (newId) await focusMethodCard(newId);
	};

	const handleToggle = (id: string, next: boolean) => {
		expandedMethodId = next ? id : null;
	};
</script>

<Card size="sm">
	<CardHeader>
		<CardTitle class="flex items-center gap-2 !text-base font-semibold">
			<UserRound size={15} />
			Your details
		</CardTitle>
		<CardDescription class="text-xs">Stays on this device — autofills every invoice.</CardDescription>
	</CardHeader>
	<CardContent class="space-y-5">
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			<Field.Field class="gap-1.5 sm:col-span-2">
				<Field.FieldLabel for="from-name">Name</Field.FieldLabel>
				<Input
					id="from-name"
					placeholder="e.g., Albus Dumbledore"
					value={fixed.value.from.name}
					oninput={e => fixed.updateFrom("name", valueFromInput(e))}
				/>
			</Field.Field>
			<Field.Field class="gap-1.5">
				<Field.FieldLabel for="from-phone">Phone</Field.FieldLabel>
				<Input
					id="from-phone"
					type="tel"
					placeholder="e.g., +880 1XXXXXXXXX"
					value={fixed.value.from.phone}
					oninput={e => fixed.updateFrom("phone", valueFromInput(e))}
				/>
			</Field.Field>
			<Field.Field class="gap-1.5" data-invalid={senderEmailError !== ""}>
				<Field.FieldLabel for="from-email">Email</Field.FieldLabel>
				<Input
					id="from-email"
					type="email"
					placeholder="e.g., albus@hogwarts.edu"
					value={fixed.value.from.email}
					aria-invalid={senderEmailError !== ""}
					oninput={e => fixed.updateFrom("email", valueFromInput(e))}
					onblur={() => (emailTouched = true)}
					class={senderEmailError ? "border-destructive focus-visible:border-destructive" : ""}
				/>
				<Field.FieldError>{senderEmailError}</Field.FieldError>
			</Field.Field>
			<Field.Field class="gap-1.5 sm:col-span-2">
				<Field.FieldLabel for="from-address">Address</Field.FieldLabel>
				<Textarea
					id="from-address"
					placeholder="e.g., Headmaster's Office, Hogwarts Castle"
					value={fixed.value.from.address}
					oninput={e => fixed.updateFrom("address", valueFromTextArea(e))}
				/>
			</Field.Field>
		</div>

		<Separator />

		<div class="space-y-3">
			<div class="flex items-center justify-between gap-3">
				<div class="flex items-center gap-2">
					<Wallet size={14} class="text-muted-foreground" />
					<p class="text-muted-foreground text-xs font-medium tracking-wider uppercase">Payment methods</p>
				</div>
				{#if methods.length > 0}
					<p class="text-muted-foreground text-xs tabular-nums">{methods.length} saved</p>
				{/if}
			</div>

			{#if methods.length === 0}
				<div
					class="border-border text-muted-foreground grid min-h-28 w-full place-items-center rounded-lg border border-dashed text-center"
				>
					<div class="space-y-1">
						<p class="text-sm font-medium">No payment methods yet</p>
						<p class="text-xs">Pick one below to attach it to your invoices.</p>
					</div>
				</div>
			{:else}
				<div class="space-y-2">
					{#each methods as method, i (method.id)}
						<div id="method-row-{method.id}">
							<PaymentMethodCard
								{method}
								index={i}
								total={methods.length}
								expanded={expandedMethodId === method.id}
								onToggle={next => handleToggle(method.id, next)}
							/>
						</div>
					{/each}
				</div>
			{/if}

			<div class="bg-muted/30 rounded-lg p-2">
				<Select.Root
					type="single"
					bind:value={pickerValue}
					onValueChange={handlePickerChange}
					disabled={pendingKind !== null}
				>
					<Select.Trigger class="h-9 w-full" aria-label="Add or open a payment method">
						<span data-slot="select-value" class="text-muted-foreground">
							{pendingKind
								? `Adding ${getMethodDef(pendingKind).name}…`
								: methods.length === 0
									? "Choose a payment method to add…"
									: "Add or open another method…"}
						</span>
					</Select.Trigger>
					<Select.Content>
						{#each PAYMENT_METHOD_KINDS as kind (kind)}
							{@const def = getMethodDef(kind)}
							{@const already = methods.some(m => m.kind === kind)}
							<Select.Item value={kind} label={def.name}>
								<div class="flex w-full items-center justify-between gap-3">
									<div class="flex flex-col gap-0.5">
										<span class="text-sm font-medium">{def.name}</span>
										<span class="text-muted-foreground text-[11px]">{def.description}</span>
									</div>
									{#if already}
										<span
											class="text-muted-foreground/80 shrink-0 text-[10px] tracking-wider uppercase"
										>
											Open
										</span>
									{/if}
								</div>
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		</div>
	</CardContent>
</Card>
