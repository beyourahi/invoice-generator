<script lang="ts">
	import { fixed } from "$lib/stores/fixed.svelte";
	import { PAYMENT_METHOD_KINDS, getMethodDef } from "$lib/payments/registry";
	import type { PaymentMethodKind } from "$lib/types";
	import Input from "$lib/components/ui/input.svelte";
	import Textarea from "$lib/components/ui/textarea.svelte";
	import Separator from "$lib/components/ui/separator.svelte";
	import Button from "$lib/components/ui/button.svelte";
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "$lib/components/ui/card";
	import * as Field from "$lib/components/ui/field";
	import * as Select from "$lib/components/ui/select";
	import PaymentMethodCard from "$src/components/PaymentMethodCard.svelte";
	import { Plus, UserRound, Wallet } from "@lucide/svelte";
	import { z } from "zod";

	let emailTouched = $state(false);
	let pickerKind = $state<PaymentMethodKind | "">("");

	const optionalEmailSchema = z.union([z.literal(""), z.string().trim().email("Enter a valid sender email.")]);
	const senderEmailError = $derived(
		emailTouched && !optionalEmailSchema.safeParse(fixed.value.from.email).success
			? "Enter a valid sender email."
			: ""
	);
	const valueFromInput = (e: Event) => (e.currentTarget as HTMLInputElement).value;
	const valueFromTextArea = (e: Event) => (e.currentTarget as HTMLTextAreaElement).value;

	const pickerLabel = $derived(pickerKind ? getMethodDef(pickerKind).name : "Choose a method...");
	const methods = $derived(fixed.value.paymentMethods);

	const addSelected = () => {
		if (!pickerKind) return;
		fixed.addPaymentMethod(pickerKind);
		pickerKind = "";
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
					placeholder="e.g., Tony Stark"
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
					placeholder="e.g., tony@stark.io"
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
					placeholder="e.g., 10880 Malibu Point, CA"
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
						<p class="text-xs">Add one below to attach it to your invoices.</p>
					</div>
				</div>
			{:else}
				<div class="space-y-2">
					{#each methods as method, i (method.id)}
						<PaymentMethodCard {method} index={i} total={methods.length} />
					{/each}
				</div>
			{/if}

			<div class="bg-muted/30 flex flex-col gap-2 rounded-lg p-2 sm:flex-row sm:items-center">
				<Select.Root
					type="single"
					value={pickerKind}
					onValueChange={v => (pickerKind = (v as PaymentMethodKind) ?? "")}
				>
					<Select.Trigger class="h-9 w-full sm:flex-1">
						<span data-slot="select-value">{pickerLabel}</span>
					</Select.Trigger>
					<Select.Content>
						{#each PAYMENT_METHOD_KINDS as kind (kind)}
							{@const def = getMethodDef(kind)}
							<Select.Item value={kind} label={def.name}>
								<div class="flex flex-col gap-0.5">
									<span class="text-sm font-medium">{def.name}</span>
									<span class="text-muted-foreground text-[11px]">{def.description}</span>
								</div>
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<Button
					size="sm"
					class="bg-brand text-brand-foreground hover:bg-brand/90 h-9 shrink-0"
					onclick={addSelected}
					disabled={!pickerKind}
				>
					<Plus size={13} />
					Add method
				</Button>
			</div>
		</div>
	</CardContent>
</Card>
