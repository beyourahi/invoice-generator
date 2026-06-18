<!--
	Editor for the fixed sender identity (name/phone/email/address) and the saved
	payment-method list that every invoice draws from. Add/remove/reorder of methods
	is animated via GSAP Flip; the picker opens an existing method instead of duplicating.
-->
<script lang="ts">
	import { tick } from "svelte";
	import { fixed } from "$lib/stores/fixed.svelte";
	import { session } from "$lib/stores/session.svelte";
	import { PAYMENT_METHOD_KINDS, getMethodDef } from "$lib/payments/registry";
	import type { PaymentMethodKind } from "$lib/types";
	import Input from "$lib/components/ui/input.svelte";
	import Textarea from "$lib/components/ui/textarea.svelte";
	import { Separator } from "$lib/components/ui/separator";
	import { Card, CardContent } from "$lib/components/ui/card";
	import * as Field from "$lib/components/ui/field";
	import SelectDialog from "$src/components/SelectDialog.svelte";
	import PaymentMethodCard from "$src/components/PaymentMethodCard.svelte";
	import SectionEyebrow from "$src/components/SectionEyebrow.svelte";
	import { flipList } from "$lib/motion";
	import { UserRound, Wallet } from "@lucide/svelte";
	import { z } from "zod";

	let emailTouched = $state(false);
	let expandedMethodId = $state<string | null>(null);
	let pendingKind = $state<PaymentMethodKind | null>(null);
	let pickerValue = $state<string>("");
	let methodListEl = $state<HTMLDivElement | null>(null);

	// flipList snapshots positions, then plays the FLIP tween after the store mutation reflows the list.
	const removeMethodAnimated = async (id: string) => {
		if (!methodListEl) {
			fixed.removePaymentMethod(id);
			session.purgePaymentMethodFromClients(id);
			return;
		}
		const play = await flipList(methodListEl);
		fixed.removePaymentMethod(id);
		session.purgePaymentMethodFromClients(id);
		await play();
	};

	const moveMethodAnimated = async (id: string, direction: -1 | 1) => {
		if (!methodListEl) {
			fixed.movePaymentMethod(id, direction);
			return;
		}
		const play = await flipList(methodListEl);
		fixed.movePaymentMethod(id, direction);
		await play();
	};

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

	// Selecting a kind that already exists opens/focuses it rather than adding a duplicate.
	// pendingKind guards against re-entrant adds while an async addPaymentMethod is in flight.
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
		const play = methodListEl ? await flipList(methodListEl) : null;
		const newId = await fixed.addPaymentMethod(kind);
		pendingKind = null;
		if (play) await play();
		if (newId) await focusMethodCard(newId);
	};

	const handleToggle = (id: string, next: boolean) => {
		expandedMethodId = next ? id : null;
	};
</script>

<div class="space-y-3">
	<div class="space-y-2">
		<SectionEyebrow icon={UserRound} label="Your details" />
		<p class="text-ink-muted text-xs text-pretty">Stays on this device — autofills every invoice.</p>
	</div>

	<Card size="sm">
		<CardContent class="space-y-5">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<Field.Field class="gap-1.5">
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
				<Field.Field class="gap-1.5">
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
					<SectionEyebrow icon={Wallet} label="Payment methods" />
					{#if methods.length > 0}
						<p class="text-ink-muted font-mono text-micro tracking-wider whitespace-nowrap tabular-nums">
							{methods.length} saved
						</p>
					{/if}
				</div>

				{#if methods.length === 0}
					<div
						class="border-hair text-ink-muted grid min-h-28 w-full place-items-center rounded-xl border border-dashed text-center"
					>
						<div class="space-y-1">
							<p class="text-sm font-medium text-balance">No payment methods yet</p>
							<p class="text-xs text-pretty">Pick one below to attach it to your invoices.</p>
						</div>
					</div>
				{:else}
					<div class="space-y-2" bind:this={methodListEl}>
						{#each methods as method, i (method.id)}
							<div id="method-row-{method.id}">
								<PaymentMethodCard
									{method}
									index={i}
									total={methods.length}
									expanded={expandedMethodId === method.id}
									onToggle={next => handleToggle(method.id, next)}
									onRemove={() => removeMethodAnimated(method.id)}
									onMove={direction => moveMethodAnimated(method.id, direction)}
								/>
							</div>
						{/each}
					</div>
				{/if}

				<div class="bg-muted/30 rounded-lg p-2">
					<SelectDialog
						value={pickerValue}
						title="Add payment method"
						placeholder={pendingKind
							? `Adding ${getMethodDef(pendingKind).name}…`
							: methods.length === 0
								? "Choose a payment method to add…"
								: "Add or open another method…"}
						options={PAYMENT_METHOD_KINDS.map(kind => {
							const def = getMethodDef(kind);
							const already = methods.some(m => m.kind === kind);
							return {
								value: kind,
								label: def.name,
								description: def.description,
								badge: already ? "Open" : undefined
							};
						})}
						onSelect={handlePickerChange}
						disabled={pendingKind !== null}
					/>
				</div>
			</div>
		</CardContent>
	</Card>
</div>
