<script lang="ts">
	import { fixed } from "$lib/stores/fixed.svelte";
	import Input from "$lib/components/ui/input.svelte";
	import Label from "$lib/components/ui/label.svelte";
	import Separator from "$lib/components/ui/separator.svelte";
	import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
</script>

<Card>
	<CardHeader>
		<CardTitle>Sender</CardTitle>
	</CardHeader>
	<CardContent class="space-y-4">
		<div class="grid grid-cols-2 gap-3">
			<div class="col-span-2">
				<Label for="from-name">name</Label>
				<Input
					id="from-name"
					placeholder="Full Name"
					value={fixed.value.from.name}
					oninput={e => fixed.updateFrom("name", (e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div>
				<Label for="from-phone">phone</Label>
				<Input
					id="from-phone"
					type="tel"
					placeholder="+880..."
					value={fixed.value.from.phone}
					oninput={e => fixed.updateFrom("phone", (e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div>
				<Label for="from-email">email</Label>
				<Input
					id="from-email"
					type="email"
					placeholder="you@email.com"
					value={fixed.value.from.email}
					oninput={e => fixed.updateFrom("email", (e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div class="col-span-2">
				<Label for="from-address">address</Label>
				<Input
					id="from-address"
					placeholder="City, Country"
					value={fixed.value.from.address}
					oninput={e => fixed.updateFrom("address", (e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
		</div>

		<Separator />

		<p class="text-foreground/70 text-xs font-semibold tracking-wider uppercase">Bank Details</p>

		<div class="grid grid-cols-2 gap-3">
			<div>
				<Label for="bank-holder">account holder</Label>
				<Input
					id="bank-holder"
					placeholder="Full Name"
					value={fixed.value.bank.holder}
					oninput={e => fixed.updateBank("holder", (e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div>
				<Label for="bank-name">bank name</Label>
				<Input
					id="bank-name"
					placeholder="Bank Name"
					value={fixed.value.bank.name}
					oninput={e => fixed.updateBank("name", (e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div>
				<Label for="bank-account">account number</Label>
				<Input
					id="bank-account"
					placeholder="0000000000000"
					value={fixed.value.bank.account}
					oninput={e => fixed.updateBank("account", (e.currentTarget as HTMLInputElement).value)}
					class="tabular-nums"
				/>
			</div>
			<div>
				<Label for="bank-branch">branch</Label>
				<Input
					id="bank-branch"
					placeholder="Branch name"
					value={fixed.value.bank.branch}
					oninput={e => fixed.updateBank("branch", (e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div class="col-span-2">
				<Label for="bank-routing">routing</Label>
				<Input
					id="bank-routing"
					placeholder="000000000"
					value={fixed.value.bank.routing}
					oninput={e => fixed.updateBank("routing", (e.currentTarget as HTMLInputElement).value)}
					class="tabular-nums"
				/>
			</div>
		</div>
	</CardContent>
</Card>
