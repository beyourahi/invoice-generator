<script lang="ts">
	import { fixed } from "$lib/stores/fixed.svelte";
	import Input from "$lib/components/ui/input.svelte";
	import Label from "$lib/components/ui/label.svelte";
	import Separator from "$lib/components/ui/separator.svelte";
	import { ChevronDown, User } from "@lucide/svelte";

	let senderOpen = $state(true);
	let bankOpen = $state(false);
</script>

<div class="border-border/60 bg-card overflow-hidden rounded-2xl border">
	<button
		onclick={() => (senderOpen = !senderOpen)}
		class="hover:bg-accent/30 flex w-full items-center justify-between px-5 py-4
               text-left transition-colors"
	>
		<div class="flex items-center gap-2.5">
			<User size={14} class="text-muted-foreground" />
			<span class="text-sm font-medium">sender details</span>
		</div>
		<ChevronDown
			size={14}
			class="text-muted-foreground transition-transform duration-200 {senderOpen ? 'rotate-180' : ''}"
		/>
	</button>

	{#if senderOpen}
		<div class="border-border/40 space-y-3 border-t px-5 pb-5">
			<div class="pt-4">
				<Label for="from-name">your name</Label>
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
			<div>
				<Label for="from-address">address</Label>
				<Input
					id="from-address"
					placeholder="City, Country"
					value={fixed.value.from.address}
					oninput={e => fixed.updateFrom("address", (e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
		</div>
	{/if}

	<Separator />

	<button
		onclick={() => (bankOpen = !bankOpen)}
		class="hover:bg-accent/30 flex w-full items-center justify-between px-5 py-4
               text-left transition-colors"
	>
		<div class="flex items-center gap-2.5">
			<svg
				class="text-muted-foreground"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<rect width="20" height="14" x="2" y="5" rx="2" />
				<line x1="2" x2="22" y1="10" y2="10" />
			</svg>
			<span class="text-sm font-medium">bank details</span>
		</div>
		<ChevronDown
			size={14}
			class="text-muted-foreground transition-transform duration-200 {bankOpen ? 'rotate-180' : ''}"
		/>
	</button>

	{#if bankOpen}
		<div class="border-border/40 space-y-3 border-t px-5 pb-5">
			<div class="pt-4">
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
			<div class="grid grid-cols-2 gap-3">
				<div>
					<Label for="bank-branch">branch</Label>
					<Input
						id="bank-branch"
						placeholder="Branch name"
						value={fixed.value.bank.branch}
						oninput={e => fixed.updateBank("branch", (e.currentTarget as HTMLInputElement).value)}
					/>
				</div>
				<div>
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
		</div>
	{/if}
</div>
