<script lang="ts">
	import { buildInvoiceHtml } from "$lib/invoice/builder";
	import { fixed } from "$lib/stores/fixed.svelte";
	import { session } from "$lib/stores/session.svelte";
	import { getTheme, ACTIVE_THEME_ID } from "$lib/themes/registry";
	import { Separator } from "$lib/components/ui/separator";
	import AddClientButton from "$src/components/AddClientButton.svelte";
	import ClientCard from "$src/components/ClientCard.svelte";
	import FixedSenderPanel from "$src/components/FixedSenderPanel.svelte";
	import GenerationPanel from "$src/components/GenerationPanel.svelte";
	import InvoicePreview from "$src/components/InvoicePreview.svelte";
	import Heading from "$lib/components/ui/heading/heading.svelte";
	import { page } from "$app/state";
	import User from "$src/components/User.svelte";
	import { onMount, type Component } from "svelte";
	import { UserPlus } from "@lucide/svelte";

	let ToasterComponent = $state<Component | null>(null);

	const previewClient = $derived(
		session.clients.find(c => c.id === session.selectedClientId) ?? session.clients[0] ?? null
	);
	const previewHtml = $derived.by(() => {
		const client = previewClient;
		if (!client || client.invoices.length === 0) {
			return null;
		}
		const entry = client.invoices[0];
		return buildInvoiceHtml(client, entry, fixed.value, getTheme(ACTIVE_THEME_ID));
	});

	onMount(async () => {
		ToasterComponent = (await import("$lib/components/ui/sonner")).Toaster;
	});
</script>

<svelte:head>
	<title>Invoice Generator</title>
</svelte:head>

{#if ToasterComponent}
	<ToasterComponent theme="dark" position="bottom-right" richColors closeButton />
{/if}

{#if page.data.user && page.data.currentUser}
	<User user={page.data.user} currentUser={page.data.currentUser} />
{/if}

<main class="mx-auto max-w-6xl px-4 py-8 lg:max-w-7xl">
	<div class="mb-8">
		<Heading />
	</div>

	<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
		<section class="space-y-4">
			<FixedSenderPanel />

			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<h2 class="text-base font-semibold">Clients</h2>
					<p class="text-muted-foreground text-xs tabular-nums">
						{session.clients.length} total
					</p>
				</div>

				{#if session.clients.length === 0}
					<button
						class="border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground grid min-h-36 w-full cursor-pointer place-items-center rounded-lg border border-dashed text-center transition-colors"
						onclick={session.addClient}
					>
						<div class="flex flex-col items-center gap-2">
							<UserPlus size={18} />
							<p class="text-sm font-medium">Add client</p>
						</div>
					</button>
				{:else}
					<div class="space-y-3">
						{#each session.clients as client, i (client.id)}
							<ClientCard
								{client}
								index={i}
								selected={previewClient?.id === client.id}
								onSelect={() => session.setSelectedClientId(client.id)}
							/>
						{/each}
					</div>
				{/if}

				{#if session.clients.length > 0}
					<AddClientButton />
				{/if}
			</div>
		</section>

		<section class="lg:sticky lg:top-8 lg:self-start">
			<InvoicePreview html={previewHtml} loading={false} />
		</section>
	</div>

	<Separator class="my-6" />
	<GenerationPanel />
</main>
