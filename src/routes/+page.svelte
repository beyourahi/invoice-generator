<!--
	Home page — the single authenticated surface. Tabbed shell (Details / Preview)
	plus a full-width GenerationPanel below. Seeds the three client stores from
	server-loaded data ONCE inside untrack() (see below). Toaster is lazy-imported
	in onMount to keep it out of the SSR/initial bundle.

	HYDRATION TRAP (whole-app double-render): never nest a native <button> inside
	another <button> in collapsible cards. SSR auto-closes the outer button early,
	desyncing Svelte's hydration walker and re-appending the entire app. ClientCard/
	PaymentMethodCard use div[role="button"] + tabindex + Enter/Space instead.
-->
<script lang="ts">
	import { buildInvoiceHtml } from "$lib/invoice/builder";
	import { firstGeneratableInvoice } from "$lib/invoice/active";
	import { fixed } from "$lib/stores/fixed.svelte";
	import { session } from "$lib/stores/session.svelte";
	import { ai } from "$lib/stores/ai.svelte";
	import { getTheme, ACTIVE_THEME_ID } from "$lib/themes/registry";
	import { Separator } from "$lib/components/ui/separator";
	import * as Tabs from "$lib/components/ui/tabs";
	import AddClientButton from "$src/components/AddClientButton.svelte";
	import SectionEyebrow from "$src/components/SectionEyebrow.svelte";
	import ClientCard from "$src/components/ClientCard.svelte";
	import FixedSenderPanel from "$src/components/FixedSenderPanel.svelte";
	import GenerationPanel from "$src/components/GenerationPanel.svelte";
	import InvoicePreview from "$src/components/InvoicePreview.svelte";
	import Heading from "$lib/components/ui/heading/heading.svelte";
	import { page } from "$app/state";
	import User from "$src/components/User.svelte";
	import SignInButton from "$src/components/SignInButton.svelte";
	import { migrateGuestToServer } from "$lib/persistence/migrate";
	import { onMount, untrack, type Component } from "svelte";
	import { fade } from "svelte/transition";
	import { reveal, motionDuration, flipList } from "$lib/motion";
	import { ScanLine, SquarePen, UserPlus, Users } from "@lucide/svelte";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let clientListEl = $state<HTMLDivElement | null>(null);

	const addClientAnimated = async () => {
		if (!clientListEl) {
			await session.addClient();
			return;
		}
		const play = await flipList(clientListEl);
		await session.addClient();
		await play();
	};

	const removeClientAnimated = async (id: string) => {
		if (!clientListEl) {
			session.removeClient(id);
			return;
		}
		const play = await flipList(clientListEl);
		session.removeClient(id);
		await play();
	};

	// INVARIANT: the ONLY server-data hydration site. untrack() seeds stores from
	// server data without registering them as reactive deps of this render. For
	// guests the server state is empty; the real local state loads in onMount
	// (localStorage is browser-only). `authed` routes writes to D1 vs local.
	untrack(() => {
		fixed.hydrate(data.appState.fixed, { authed: !!data.user });
		session.hydrate(
			{
				clients: data.appState.clients,
				selectedClientId: data.appState.selectedClientId,
				expandedClients: data.appState.expandedClients
			},
			{ authed: !!data.user }
		);
		ai.hydrate(data.ai);
	});

	let ToasterComponent = $state<Component | null>(null);
	let activeTab = $state("details");

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

		// Persistence bridge (browser-only): authed → import any prior guest
		// workspace into the empty account once, then reload so the server load
		// re-hydrates from D1; guest → re-seed the stores from localStorage.
		if (data.user) {
			const a = data.appState;
			const accountEmpty =
				a.clients.length === 0 &&
				a.fixed.paymentMethods.length === 0 &&
				!a.fixed.from.name &&
				!a.fixed.from.phone &&
				!a.fixed.from.email &&
				!a.fixed.from.address &&
				!a.selectedClientId;
			if (await migrateGuestToServer(accountEmpty)) location.reload();
		} else {
			fixed.loadGuest();
			session.loadGuest();
		}
	});
</script>

{#if ToasterComponent}
	<ToasterComponent theme="dark" position="bottom-right" richColors closeButton />
{/if}

{#if page.data.user && page.data.currentUser}
	<User user={page.data.user} currentUser={page.data.currentUser} />
{:else}
	<SignInButton />
{/if}

<main class="flex w-full min-w-0 grow flex-col px-[var(--content-x)] py-16 sm:py-20">
	<div class="m-auto flex w-full min-w-0 flex-col items-center gap-12 sm:gap-16 lg:gap-16">
		<div use:reveal>
			<Heading />
		</div>

		<div class="flex w-full min-w-0 flex-col gap-8 sm:gap-10 lg:gap-12">
			<Tabs.Root bind:value={activeTab} class="gap-6">
				<Tabs.List class="w-full self-center group-data-horizontal/tabs:h-auto sm:w-fit">
					<Tabs.Trigger
						value="details"
						class="h-auto min-h-11 gap-2 px-6 py-3 font-mono text-xs tracking-[0.1em] uppercase"
					>
						<SquarePen aria-hidden="true" />
						Details
					</Tabs.Trigger>
					<Tabs.Trigger
						value="preview"
						class="h-auto min-h-11 gap-2 px-6 py-3 font-mono text-xs tracking-[0.1em] uppercase"
					>
						<ScanLine aria-hidden="true" />
						Preview
					</Tabs.Trigger>
				</Tabs.List>

				<Tabs.Content value="details">
					<div
						class="grid w-full min-w-0 grid-cols-1 items-start gap-6"
						in:fade={{ duration: motionDuration("fast") }}
					>
						<div class="min-w-0" use:reveal={{ delay: 0.05 }}>
							<FixedSenderPanel />
						</div>

						<div class="min-w-0 space-y-3" use:reveal={{ delay: 0.1 }}>
							<div class="flex items-center justify-between">
								<SectionEyebrow icon={Users} label="Clients" />
								<p
									class="text-ink-muted font-mono text-micro tracking-wider whitespace-nowrap tabular-nums"
								>
									{session.clients.length} total
								</p>
							</div>

							{#if session.clients.length === 0}
								<button
									class="border-hair text-ink-muted pointer-fine:hover:border-signal/40 pointer-fine:hover:text-foreground grid min-h-36 w-full cursor-pointer place-items-center rounded-xl border border-dashed text-center transition-colors duration-[250ms] ease-[var(--ease)]"
									onclick={session.addClient}
									aria-label="Add client"
								>
									<div class="flex flex-col items-center gap-2">
										<UserPlus size={18} aria-hidden="true" />
										<p class="text-sm font-medium">Add client</p>
									</div>
								</button>
							{:else}
								<div class="space-y-3" bind:this={clientListEl}>
									{#each session.clients as client, i (client.id)}
										<ClientCard
											{client}
											index={i}
											selected={previewClient?.id === client.id}
											onSelect={() => session.setSelectedClientId(client.id)}
											onRemove={() => removeClientAnimated(client.id)}
										/>
									{/each}
								</div>
							{/if}

							{#if session.clients.length > 0}
								<AddClientButton onAdd={addClientAnimated} />
							{/if}
						</div>
					</div>
				</Tabs.Content>

				<Tabs.Content value="preview">
					<div class="mx-auto w-full" in:fade={{ duration: motionDuration("fast") }}>
						<InvoicePreview html={previewHtml} loading={false} emptyReason={previewEmptyReason} />
					</div>
				</Tabs.Content>
			</Tabs.Root>

			<Separator />
			<div use:reveal={{ onScroll: true }}>
				<GenerationPanel />
			</div>
		</div>
	</div>
</main>
