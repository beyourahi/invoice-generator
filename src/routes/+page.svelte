<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import { fixed } from "$lib/stores/fixed.svelte";
	import FixedSenderPanel from "$src/components/FixedSenderPanel.svelte";
	import ClientCard from "$src/components/ClientCard.svelte";
	import AddClientButton from "$src/components/AddClientButton.svelte";
	import InvoicePreview from "$src/components/InvoicePreview.svelte";
	import GenerationPanel from "$src/components/GenerationPanel.svelte";
	import { buildInvoiceHtml } from "$lib/invoice/builder";
	import { getTheme, ACTIVE_THEME_ID } from "$lib/themes/registry";

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
	<header class="border-border/40 border-b">
		<div class="mx-auto flex h-12 max-w-6xl items-center gap-3 px-6">
			<h1 class="text-sm font-medium tracking-tight">Invoice Generator</h1>
			<span class="text-border/60">·</span>
			<p class="text-muted-foreground/50 text-xs">batch PDF exports</p>
		</div>
	</header>

	<main class="mx-auto max-w-6xl px-6 py-6">
		<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
			<!-- Left: input column -->
			<div class="space-y-4">
				<FixedSenderPanel />

				{#if session.clients.length === 0}
					<div
						class="border-border/30 text-muted-foreground/40 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center"
					>
						<p class="text-sm">No clients yet</p>
						<p class="text-muted-foreground/25 text-xs">Add a client to get started</p>
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
			</div>

			<!-- Right: sticky preview, desktop only -->
			<div class="hidden lg:sticky lg:top-6 lg:block lg:self-start">
				<InvoicePreview html={previewHtml} loading={previewLoading} />
			</div>
		</div>

		<GenerationPanel />
	</main>
</div>
