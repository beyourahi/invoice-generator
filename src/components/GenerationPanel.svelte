<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import { fixed } from "$lib/stores/fixed.svelte";
	import { buildInvoiceHtml, getFileName, getInvoiceId } from "$lib/invoice/builder";
	import { generatePdf } from "$lib/pdf/generator";
	import { getTheme, ACTIVE_THEME_ID } from "$lib/themes/registry";
	import type { GeneratedInvoice } from "$lib/types";
	import { gsap } from "gsap";
	import { Zap, AlertCircle, TriangleAlert } from "@lucide/svelte";

	let progressEl = $state<HTMLDivElement | undefined>(undefined);
	let countEl = $state<HTMLSpanElement | undefined>(undefined);
	let progress = $state(0);

	const totalCount = $derived(session.totalInvoiceCount);

	const canGenerate = $derived(
		session.clients.length > 0 &&
			totalCount > 0 &&
			session.allClientsValid &&
			session.generationState !== "generating"
	);

	const generateAll = async () => {
		session.setGenerating();
		progress = 0;

		const theme = getTheme(ACTIVE_THEME_ID);
		const results: GeneratedInvoice[] = [];
		let completed = 0;

		if (countEl) gsap.to(countEl, { opacity: 1, duration: 0.2 });

		for (const client of session.clients) {
			for (const entry of client.invoices) {
				try {
					const html = buildInvoiceHtml(client, entry, fixed.value, theme);
					const pdfBlob = await generatePdf(html);

					results.push({
						clientName: client.name || "client",
						fileName: getFileName(client, entry),
						invoiceId: getInvoiceId(client, entry),
						year: client.year,
						pdfBlob
					});

					completed++;
					progress = Math.round((completed / totalCount) * 100);

					if (countEl) {
						gsap.to(countEl, {
							innerText: completed,
							snap: { innerText: 1 },
							duration: 0.3,
							ease: "power2.out"
						});
					}
				} catch (err) {
					session.setError(
						err instanceof Error ? err.message : "Generation failed"
					);
					return;
				}
			}
		}

		session.setGenerated(results);
	};
</script>

<div class="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
	<div class="flex items-center justify-between">
		<span class="text-sm font-medium">generate</span>
		{#if totalCount > 0}
			<span class="text-xs text-muted-foreground tabular-nums">
				{totalCount} invoice{totalCount !== 1 ? "s" : ""}
			</span>
		{/if}
	</div>

	{#if session.clients.length > 0 && !session.allClientsValid}
		<div class="flex items-start gap-2.5 rounded-xl bg-destructive/10 border border-destructive/20 p-3">
			<TriangleAlert size={14} class="text-destructive shrink-0 mt-0.5" />
			<p class="text-xs text-destructive leading-relaxed">
				all clients need a name and invoice prefix
			</p>
		</div>
	{/if}

	{#if session.generationState === "error" && session.generationError}
		<div class="flex items-start gap-2.5 rounded-xl bg-destructive/10 border border-destructive/20 p-3">
			<AlertCircle size={14} class="text-destructive shrink-0 mt-0.5" />
			<p class="text-xs text-destructive leading-relaxed">{session.generationError}</p>
		</div>
	{/if}

	{#if session.generationState === "generating"}
		<div class="space-y-3">
			<div class="flex items-center justify-between text-xs text-muted-foreground">
				<span>generating</span>
				<div bind:this={progressEl}>
					<span bind:this={countEl} class="tabular-nums opacity-0">0</span>
					<span>/{totalCount}</span>
				</div>
			</div>
			<div class="h-1 bg-secondary rounded-full overflow-hidden">
				<div
					class="h-full bg-primary rounded-full transition-all duration-300 ease-out"
					style="width: {progress}%"
				></div>
			</div>
		</div>
	{/if}

	<button
		onclick={generateAll}
		disabled={!canGenerate}
		class="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium
               flex items-center justify-center gap-2
               hover:bg-primary/90 active:scale-[0.98] active:translate-y-px
               transition-all duration-150
               disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none"
	>
		<Zap size={15} />
		{#if session.generationState === "generating"}
			generating...
		{:else if session.generationState === "done"}
			regenerate
		{:else}
			generate all invoices
		{/if}
	</button>

	{#if totalCount === 0 && session.clients.length === 0}
		<p class="text-xs text-muted-foreground/50 text-center">
			add a client to get started
		</p>
	{:else if totalCount === 0}
		<p class="text-xs text-muted-foreground/50 text-center">
			add invoice entries to clients
		</p>
	{/if}

	{#if session.generationState === "done"}
		<button
			onclick={session.resetGeneration}
			class="w-full text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1"
		>
			clear results
		</button>
	{/if}
</div>
