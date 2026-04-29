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
	import { onMount, type Component } from "svelte";

	let selectedClientId = $state<string | null>(null);
	let ToasterComponent = $state<Component | null>(null);

	const previewClient = $derived(session.clients.find(c => c.id === selectedClientId) ?? session.clients[0] ?? null);
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

<div class="min-h-dvh">
	{#if ToasterComponent}
		<ToasterComponent theme="dark" position="bottom-right" richColors closeButton />
	{/if}

	<main class="mx-auto max-w-6xl px-4 py-8">
		<header class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
			<div class="space-y-1">
				<h1 class="text-xl font-semibold tracking-tight">Invoice Generator</h1>
				<p class="text-muted-foreground max-w-2xl text-sm">
					Build recurring client invoices, preview the first document, and export PDFs in one pass.
				</p>
			</div>
			<div class="text-muted-foreground flex gap-3 text-xs tabular-nums">
				<span>{session.clients.length} clients</span>
				<span>{session.totalInvoiceCount} invoices</span>
			</div>
		</header>

		<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
			<section class="space-y-4">
				<FixedSenderPanel />

				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<h2 class="text-sm font-medium">Clients</h2>
						<p class="text-muted-foreground text-xs tabular-nums">{session.clients.length} total</p>
					</div>

					{#if session.clients.length === 0}
						<div
							class="border-border text-muted-foreground grid min-h-36 place-items-center rounded-lg border border-dashed text-center"
						>
							<div class="space-y-1">
								<p class="text-sm font-medium">No clients yet</p>
								<p class="text-xs">Add a client and schedule invoice months.</p>
							</div>
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
			</section>

			<section class="lg:sticky lg:top-8 lg:self-start">
				<InvoicePreview html={previewHtml} loading={false} />
			</section>
		</div>

		<Separator class="my-6" />
		<GenerationPanel />
	</main>
</div>
