<script lang="ts">
	import { fixed } from "$lib/stores/fixed.svelte";
	import Input from "$lib/components/ui/input.svelte";
	import Textarea from "$lib/components/ui/textarea.svelte";
	import Separator from "$lib/components/ui/separator.svelte";
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "$lib/components/ui/card";
	import * as Field from "$lib/components/ui/field";
	import { Building2, UserRound } from "@lucide/svelte";
	import { z } from "zod";

	let emailTouched = $state(false);

	const optionalEmailSchema = z.union([z.literal(""), z.string().trim().email("Enter a valid sender email.")]);
	const senderEmailError = $derived(
		emailTouched && !optionalEmailSchema.safeParse(fixed.value.from.email).success
			? "Enter a valid sender email."
			: ""
	);
	const valueFromInput = (e: Event) => (e.currentTarget as HTMLInputElement).value;
	const valueFromTextArea = (e: Event) => (e.currentTarget as HTMLTextAreaElement).value;
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
					placeholder="Full name"
					value={fixed.value.from.name}
					oninput={e => fixed.updateFrom("name", valueFromInput(e))}
				/>
			</Field.Field>
			<Field.Field class="gap-1.5">
				<Field.FieldLabel for="from-phone">Phone</Field.FieldLabel>
				<Input
					id="from-phone"
					type="tel"
					placeholder="+880..."
					value={fixed.value.from.phone}
					oninput={e => fixed.updateFrom("phone", valueFromInput(e))}
				/>
			</Field.Field>
			<Field.Field class="gap-1.5" data-invalid={senderEmailError !== ""}>
				<Field.FieldLabel for="from-email">Email</Field.FieldLabel>
				<Input
					id="from-email"
					type="email"
					placeholder="you@email.com"
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
					placeholder="City, Country"
					value={fixed.value.from.address}
					oninput={e => fixed.updateFrom("address", valueFromTextArea(e))}
				/>
			</Field.Field>
		</div>

		<Separator />

		<div class="flex items-center gap-2">
			<Building2 size={14} class="text-muted-foreground" />
			<p class="text-muted-foreground text-xs font-medium tracking-wider uppercase">Bank details</p>
		</div>

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			<Field.Field class="gap-1.5">
				<Field.FieldLabel for="bank-holder">Account holder</Field.FieldLabel>
				<Input
					id="bank-holder"
					placeholder="Full name"
					value={fixed.value.bank.holder}
					oninput={e => fixed.updateBank("holder", valueFromInput(e))}
				/>
			</Field.Field>
			<Field.Field class="gap-1.5">
				<Field.FieldLabel for="bank-name">Bank name</Field.FieldLabel>
				<Input
					id="bank-name"
					placeholder="Bank name"
					value={fixed.value.bank.name}
					oninput={e => fixed.updateBank("name", valueFromInput(e))}
				/>
			</Field.Field>
			<Field.Field class="gap-1.5">
				<Field.FieldLabel for="bank-account">Account number</Field.FieldLabel>
				<Input
					id="bank-account"
					placeholder="0000000000000"
					value={fixed.value.bank.account}
					oninput={e => fixed.updateBank("account", valueFromInput(e))}
					class="tabular-nums"
				/>
			</Field.Field>
			<Field.Field class="gap-1.5">
				<Field.FieldLabel for="bank-branch">Branch</Field.FieldLabel>
				<Input
					id="bank-branch"
					placeholder="Branch name"
					value={fixed.value.bank.branch}
					oninput={e => fixed.updateBank("branch", valueFromInput(e))}
				/>
			</Field.Field>
			<Field.Field class="gap-1.5 sm:col-span-2">
				<Field.FieldLabel for="bank-routing">Routing</Field.FieldLabel>
				<Input
					id="bank-routing"
					placeholder="000000000"
					value={fixed.value.bank.routing}
					oninput={e => fixed.updateBank("routing", valueFromInput(e))}
					class="tabular-nums"
				/>
			</Field.Field>
		</div>
	</CardContent>
</Card>
