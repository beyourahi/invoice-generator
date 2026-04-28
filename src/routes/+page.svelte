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

<div class="min-h-screen bg-background text-foreground">
	<header bind:this={headerEl} class="border-b border-border/40 px-4 sm:px-6 py-5">
		<div class="max-w-7xl mx-auto flex items-baseline gap-3">
			<h1 class="text-lg font-medium tracking-tight leading-none">
				{#each WORDMARK as char, i (i)}
					<span
						bind:this={charEls[i]}
						class={char === " " ? "inline-block w-[0.3em]" : "inline-block"}
					>{char}</span>
				{/each}
			</h1>
			<p bind:this={subtitleEl} class="text-xs text-muted-foreground hidden sm:block">
				batch pdf generation
			</p>
		</div>
	</header>

	<main class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
		<div class="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-5 items-start">
			<aside class="space-y-3">
				<FixedSenderPanel />
			</aside>

			<section class="space-y-3 min-w-0">
				{#if session.clients.length === 0}
					<div class="rounded-2xl border border-border/40 bg-card/50 p-10 text-center space-y-2">
						<p class="text-sm font-medium">no clients yet</p>
						<p class="text-xs text-muted-foreground/60">
							add a client to start configuring invoices
						</p>
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
