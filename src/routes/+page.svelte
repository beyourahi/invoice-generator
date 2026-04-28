<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import { fixed } from "$lib/stores/fixed.svelte";
	import FixedSenderPanel from "$src/components/FixedSenderPanel.svelte";
	import ClientCard from "$src/components/ClientCard.svelte";
	import AddClientButton from "$src/components/AddClientButton.svelte";
	import AppHeader from "$src/components/AppHeader.svelte";
	import InvoicePreview from "$src/components/InvoicePreview.svelte";
	import StickyActionBar from "$src/components/StickyActionBar.svelte";
	import JsonEditor from "$src/components/JsonEditor.svelte";
	import { buildInvoiceHtml } from "$lib/invoice/builder";
	import { getTheme, ACTIVE_THEME_ID } from "$lib/themes/registry";

	let jsonMode = $state(false);
	let selectedClientId = $state<string | null>(null);
	let previewHtml = $state<string | null>(null);
	let previewLoading = $state(false);

	const previewClient = $derived(session.clients.find(c => c.id === selectedClientId) ?? session.clients[0] ?? null);

	$effect(() => {
		const client = previewClient;
		const fixedVal = fixed.value;
		if (!client || client.invoices.length === 0) {
			previewHtml = null;
			previewLoading = false;
			return;
		}
		const entry = client.invoices[0];
		previewLoading = true;
		const timer = setTimeout(() => {
			previewHtml = buildInvoiceHtml(client, entry, fixedVal, getTheme(ACTIVE_THEME_ID));
			previewLoading = false;
		}, 350);
		return () => {
			clearTimeout(timer);
			previewLoading = false;
		};
	});
</script>

<div class="bg-background text-foreground min-h-screen">
	<AppHeader bind:jsonMode />

	<main class="mx-auto max-w-7xl px-6 pt-20 pb-24">
		<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-[40%_1fr]">
			<!-- Input panel -->
			<div class="min-w-0 space-y-4">
				{#if jsonMode}
					<JsonEditor onClose={() => (jsonMode = false)} />
				{:else}
					<div class="border-border/60 bg-card rounded-2xl border p-5">
						<FixedSenderPanel />
					</div>

					{#if session.clients.length === 0}
						<div class="border-border/40 bg-card/30 space-y-2 rounded-2xl border p-10 text-center">
							<p class="text-sm font-medium">no clients yet</p>
							<p class="text-muted-foreground/50 text-xs">add a client to start configuring invoices</p>
						</div>
					{:else}
						<div class="space-y-3">
							{#each session.clients as client, i (client.id)}
								<ClientCard
									{client}
									index={i}
									selected={previewClient?.id === client.id}
									onSelect={() => (selectedClientId = client.id)}
								/>
							{/each}
						</div>
					{/if}

					<AddClientButton />
				{/if}
			</div>

			<!-- Preview panel: sticky, hidden on mobile -->
			<div class="sticky top-[5rem] hidden h-[calc(100vh-5rem-4.5rem)] overflow-hidden lg:block">
				<InvoicePreview html={previewHtml} loading={previewLoading} />
			</div>
		</div>
	</main>

	<StickyActionBar />
</div>
