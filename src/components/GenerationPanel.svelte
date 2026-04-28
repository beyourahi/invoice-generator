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
					session.setError(err instanceof Error ? err.message : "Generation failed");
					return;
				}
			}
		}

		session.setGenerated(results);
	};
</script>

<div class="border-border/60 bg-card space-y-4 rounded-2xl border p-5">
	<div class="flex items-center justify-between">
		<span class="text-sm font-medium">generate</span>
		{#if totalCount > 0}
			<span class="text-muted-foreground text-xs tabular-nums">
				{totalCount} invoice{totalCount !== 1 ? "s" : ""}
			</span>
		{/if}
	</div>

	{#if session.clients.length > 0 && !session.allClientsValid}
		<div class="bg-destructive/10 border-destructive/20 flex items-start gap-2.5 rounded-xl border p-3">
			<TriangleAlert size={14} class="text-destructive mt-0.5 shrink-0" />
			<p class="text-destructive text-xs leading-relaxed">all clients need a name and invoice prefix</p>
		</div>
	{/if}

	{#if session.generationState === "error" && session.generationError}
		<div class="bg-destructive/10 border-destructive/20 flex items-start gap-2.5 rounded-xl border p-3">
			<AlertCircle size={14} class="text-destructive mt-0.5 shrink-0" />
			<p class="text-destructive text-xs leading-relaxed">{session.generationError}</p>
		</div>
	{/if}

	{#if session.generationState === "generating"}
		<div class="space-y-3">
			<div class="text-muted-foreground flex items-center justify-between text-xs">
				<span>generating</span>
				<div bind:this={progressEl}>
					<span bind:this={countEl} class="tabular-nums opacity-0">0</span>
					<span>/{totalCount}</span>
				</div>
			</div>
			<div class="bg-secondary h-1 overflow-hidden rounded-full">
				<div
					class="bg-primary h-full rounded-full transition-all duration-300 ease-out"
					style="width: {progress}%"
				></div>
			</div>
		</div>
	{/if}

	<button
		onclick={generateAll}
		disabled={!canGenerate}
		class="bg-primary text-primary-foreground hover:bg-primary/90 flex h-11 w-full items-center
               justify-center gap-2 rounded-xl text-sm
               font-medium transition-all duration-150
               active:translate-y-px active:scale-[0.98]
               disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-30"
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
		<p class="text-muted-foreground/50 text-center text-xs">add a client to get started</p>
	{:else if totalCount === 0}
		<p class="text-muted-foreground/50 text-center text-xs">add invoice entries to clients</p>
	{/if}

	{#if session.generationState === "done"}
		<button
			onclick={session.resetGeneration}
			class="text-muted-foreground/60 hover:text-muted-foreground w-full py-1 text-xs transition-colors"
		>
			clear results
		</button>
	{/if}
</div>
