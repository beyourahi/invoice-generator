<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import FixedSenderPanel from "$src/components/FixedSenderPanel.svelte";
	import ClientCard from "$src/components/ClientCard.svelte";
	import AddClientButton from "$src/components/AddClientButton.svelte";
	import GenerationPanel from "$src/components/GenerationPanel.svelte";
	import DownloadPanel from "$src/components/DownloadPanel.svelte";
	import { onMount } from "svelte";
	import { gsap } from "gsap";

	const WORDMARK = "invoice generator".split("");

	let charEls: HTMLSpanElement[] = [];
	let subtitleEl: HTMLParagraphElement;
	let headerEl: HTMLElement;

	onMount(() => {
		const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

		tl.from(headerEl, { opacity: 0, duration: 0.3 })
			.from(
				charEls,
				{
					opacity: 0,
					y: 12,
					duration: 0.5,
					stagger: 0.025
				},
				"-=0.1"
			)
			.from(
				subtitleEl,
				{
					opacity: 0,
					y: 8,
					duration: 0.4
				},
				"-=0.2"
			);
	});
</script>

<div class="bg-background text-foreground min-h-screen">
	<header bind:this={headerEl} class="border-border/40 border-b px-4 py-5 sm:px-6">
		<div class="mx-auto flex max-w-7xl items-baseline gap-3">
			<h1 class="text-lg leading-none font-medium tracking-tight">
				{#each WORDMARK as char, i (i)}
					<span bind:this={charEls[i]} class={char === " " ? "inline-block w-[0.3em]" : "inline-block"}
						>{char}</span
					>
				{/each}
			</h1>
			<p bind:this={subtitleEl} class="text-muted-foreground hidden text-xs sm:block">batch pdf generation</p>
		</div>
	</header>

	<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
		<div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-[280px_1fr_280px]">
			<aside class="space-y-3">
				<FixedSenderPanel />
			</aside>

			<section class="min-w-0 space-y-3">
				{#if session.clients.length === 0}
					<div class="border-border/40 bg-card/50 space-y-2 rounded-2xl border p-10 text-center">
						<p class="text-sm font-medium">no clients yet</p>
						<p class="text-muted-foreground/60 text-xs">add a client to start configuring invoices</p>
					</div>
				{:else}
					<div class="space-y-4">
						{#each session.clients as client (client.id)}
							<ClientCard {client} />
						{/each}
					</div>
				{/if}

				<AddClientButton />
			</section>

			<aside class="space-y-3 lg:sticky lg:top-6">
				{#if session.generationState === "done" && session.generatedInvoices.length > 0}
					<DownloadPanel />
				{/if}
				<GenerationPanel />
			</aside>
		</div>
	</main>
</div>
