<script lang="ts">
	import { buildInvoiceHtml } from "$lib/invoice/builder";
	import { firstGeneratableInvoice } from "$lib/invoice/active";
	import { fixed } from "$lib/stores/fixed.svelte";
	import { session } from "$lib/stores/session.svelte";
	import { ai } from "$lib/stores/ai.svelte";
	import { getTheme, ACTIVE_THEME_ID } from "$lib/themes/registry";
	import { Separator } from "$lib/components/ui/separator";
	import AddClientButton from "$src/components/AddClientButton.svelte";
	import ClientCard from "$src/components/ClientCard.svelte";
	import FixedSenderPanel from "$src/components/FixedSenderPanel.svelte";
	import GenerationPanel from "$src/components/GenerationPanel.svelte";
	import InvoicePreview from "$src/components/InvoicePreview.svelte";
	import AiSidebar from "$src/components/ai/AiSidebar.svelte";
	import AiConfirmDialog from "$src/components/ai/AiConfirmDialog.svelte";
	import AiMobileFab from "$src/components/ai/AiMobileFab.svelte";
	import AiMobileSheet from "$src/components/ai/AiMobileSheet.svelte";
	import Heading from "$lib/components/ui/heading/heading.svelte";
	import { page } from "$app/state";
	import User from "$src/components/User.svelte";
	import { onMount, untrack, type Component } from "svelte";
	import { ChevronDown, ScanLine, UserPlus, Users } from "@lucide/svelte";
	import { cn } from "$lib/utils";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	untrack(() => {
		fixed.hydrate(data.appState.fixed);
		session.hydrate({
			clients: data.appState.clients,
			selectedClientId: data.appState.selectedClientId,
			expandedClients: data.appState.expandedClients
		});
		ai.hydrate(data.ai);
	});

	let ToasterComponent = $state<Component | null>(null);
	let previewOpen = $state(false);

	const previewClient = $derived(
		session.clients.find(c => c.id === session.selectedClientId) ?? session.clients[0] ?? null
	);
	const previewHtml = $derived.by(() => {
		const client = previewClient;
		if (!client) return null;
		const entry = firstGeneratableInvoice(client);
		if (!entry) return null;
		return buildInvoiceHtml(client, entry, fixed.value, getTheme(ACTIVE_THEME_ID));
	});
	const previewEmptyReason = $derived.by((): "no-client" | "no-entries" | "no-active" => {
		const client = previewClient;
		if (!client) return "no-client";
		if (client.invoices.length === 0) return "no-entries";
		return "no-active";
	});

	onMount(async () => {
		ToasterComponent = (await import("$lib/components/ui/sonner")).Toaster;
	});
</script>

{#if ToasterComponent}
	<ToasterComponent theme="dark" position="bottom-right" richColors closeButton />
{/if}

{#if page.data.user && page.data.currentUser}
	<User user={page.data.user} currentUser={page.data.currentUser} />
{/if}

<div class="flex w-full grow flex-col lg:flex-row">
	<main class="flex min-w-0 grow flex-col items-center gap-12 px-4 pt-16 pb-6 sm:gap-16 sm:pt-20 sm:pb-8 lg:gap-20">
		<Heading />

		<div class="container flex w-full min-w-0 flex-col gap-8 sm:gap-10 lg:gap-12">
			<div class="grid w-full min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-8">
				<section class="min-w-0 space-y-4">
					<FixedSenderPanel />

					<div class="space-y-3">
						<div class="flex items-center justify-between">
							<h2 class="flex items-center gap-2 text-base font-semibold text-balance">
								<Users size={15} aria-hidden="true" />
								<span class="whitespace-nowrap">Clients</span>
							</h2>
							<p class="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
								{session.clients.length} total
							</p>
						</div>

						{#if session.clients.length === 0}
							<button
								class="border-border text-muted-foreground pointer-fine:hover:border-foreground/30 pointer-fine:hover:text-foreground grid min-h-36 w-full cursor-pointer place-items-center rounded-lg border border-dashed text-center transition-colors"
								onclick={session.addClient}
								aria-label="Add client"
							>
								<div class="flex flex-col items-center gap-2">
									<UserPlus size={18} aria-hidden="true" />
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

				<section class="min-w-0 space-y-3 lg:sticky lg:top-8 lg:space-y-0 lg:self-start">
					<button
						type="button"
						onclick={() => (previewOpen = !previewOpen)}
						aria-expanded={previewOpen}
						aria-controls="preview-panel"
						class="border-border bg-card pointer-fine:hover:bg-accent/40 flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors lg:hidden"
					>
						<span class="flex items-center gap-2">
							<ScanLine size={15} class="text-muted-foreground" aria-hidden="true" />
							<span class="text-sm font-semibold whitespace-nowrap">Preview</span>
							<span class="text-muted-foreground text-xs whitespace-nowrap">First scheduled invoice</span>
						</span>
						<ChevronDown
							size={16}
							class={cn(
								"text-muted-foreground transition-transform duration-200",
								previewOpen && "rotate-180"
							)}
							aria-hidden="true"
						/>
					</button>
					<div
						id="preview-panel"
						class={cn(
							"grid grid-cols-1 transition-[grid-template-rows] duration-200",
							"lg:grid-rows-[1fr]",
							previewOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr] lg:grid-rows-[1fr]"
						)}
					>
						<div class="min-h-0 min-w-0 overflow-hidden lg:overflow-visible">
							<InvoicePreview html={previewHtml} loading={false} emptyReason={previewEmptyReason} />
						</div>
					</div>
				</section>
			</div>

			<Separator />
			<GenerationPanel />
		</div>
	</main>

	{#if ai.enabled}
		<aside class="hidden shrink-0 lg:block lg:w-[26rem] xl:w-[28rem]">
			<div class="sticky top-0 h-dvh p-2.5">
				<AiSidebar />
			</div>
		</aside>
	{/if}
</div>

{#if ai.enabled}
	<AiMobileFab />
	<AiMobileSheet />
	<AiConfirmDialog />
{/if}
