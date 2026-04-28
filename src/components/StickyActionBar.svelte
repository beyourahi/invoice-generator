<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import { fixed } from "$lib/stores/fixed.svelte";
	import { buildInvoiceHtml, getFileName, getInvoiceId } from "$lib/invoice/builder";
	import { generatePdf } from "$lib/pdf/generator";
	import { getTheme, ACTIVE_THEME_ID } from "$lib/themes/registry";
	import { buildZip } from "$lib/pdf/zip";
	import { downloadBlob } from "$lib/utils";
	import type { GeneratedInvoice } from "$lib/types";
	import { gsap } from "gsap";
	import { onMount } from "svelte";
	import { Zap, Download, Archive, AlertCircle, TriangleAlert, RotateCcw, Loader2 } from "@lucide/svelte";

	let barEl: HTMLElement;
	let countEl: HTMLSpanElement | undefined = $state();
	let progress = $state(0);
	let zipping = $state(false);

	const totalCount = $derived(session.totalInvoiceCount);
	const canGenerate = $derived(
		session.clients.length > 0 &&
			totalCount > 0 &&
			session.allClientsValid &&
			session.generationState !== "generating"
	);

	onMount(() => {
		gsap.from(barEl, { y: 20, opacity: 0, duration: 0.4, ease: "power3.out" });
	});

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

	const downloadOne = (index: number) => {
		const invoice = session.generatedInvoices[index];
		if (invoice) downloadBlob(invoice.pdfBlob, invoice.fileName);
	};

	const downloadAll = async () => {
		zipping = true;
		try {
			const zip = await buildZip(session.generatedInvoices);
			downloadBlob(zip, "invoices.zip");
		} finally {
			zipping = false;
		}
	};
</script>

<div
	bind:this={barEl}
	class="border-border/40 bg-background/95 fixed right-0 bottom-0 left-0 z-50 h-[72px] border-t backdrop-blur-sm"
>
	<div class="mx-auto flex h-full max-w-7xl items-center gap-4 px-6">
		<!-- Stats -->
		<div class="min-w-[120px] shrink-0">
			<p class="text-muted-foreground text-xs tabular-nums">
				{session.clients.length} client{session.clients.length !== 1 ? "s" : ""} ·
				{totalCount} invoice{totalCount !== 1 ? "s" : ""}
			</p>
		</div>

		<!-- Center status -->
		<div class="flex flex-1 items-center justify-center">
			{#if session.generationState === "generating"}
				<div class="flex w-full max-w-xs items-center gap-3">
					<div class="bg-secondary h-1 flex-1 overflow-hidden rounded-full">
						<div
							class="bg-brand h-full rounded-full transition-all duration-300 ease-out"
							style="width: {progress}%"
						></div>
					</div>
					<div class="text-muted-foreground shrink-0 text-xs tabular-nums">
						<span bind:this={countEl} class="opacity-0">0</span>/{totalCount}
					</div>
				</div>
			{:else if session.generationState === "done"}
				<p class="text-muted-foreground text-xs">
					{session.generatedInvoices.length} invoice{session.generatedInvoices.length !== 1 ? "s" : ""} ready
				</p>
			{:else if session.generationState === "error" && session.generationError}
				<div class="flex items-center gap-1.5">
					<AlertCircle size={12} class="text-destructive shrink-0" />
					<p class="text-destructive max-w-[280px] truncate text-xs">{session.generationError}</p>
				</div>
			{:else if session.clients.length > 0 && !session.allClientsValid}
				<div class="flex items-center gap-1.5">
					<TriangleAlert size={12} class="text-destructive/70 shrink-0" />
					<p class="text-destructive/70 text-xs">all clients need a name and invoice prefix</p>
				</div>
			{:else if canGenerate}
				<p class="text-muted-foreground/40 text-xs">ready to generate</p>
			{/if}
		</div>

		<!-- Action buttons -->
		<div class="flex shrink-0 items-center gap-2">
			{#if session.generationState === "done"}
				<button
					onclick={session.resetGeneration}
					class="border-border/60 text-muted-foreground hover:border-border hover:text-foreground flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs transition-all duration-150"
				>
					<RotateCcw size={12} />
					Regenerate
				</button>
				{#if session.generatedInvoices.length === 1}
					<button
						onclick={() => downloadOne(0)}
						class="bg-brand text-brand-foreground hover:bg-brand/90 flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-medium transition-all duration-150 active:scale-[0.98]"
					>
						<Download size={14} />
						Download PDF
					</button>
				{:else}
					<button
						onclick={downloadAll}
						disabled={zipping}
						class="bg-brand text-brand-foreground hover:bg-brand/90 flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
					>
						<Archive size={14} />
						{zipping ? "Zipping..." : "Download ZIP"}
					</button>
				{/if}
			{:else if session.generationState === "error"}
				<button
					onclick={generateAll}
					class="bg-brand text-brand-foreground hover:bg-brand/90 flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-medium transition-all duration-150 active:scale-[0.98]"
				>
					<RotateCcw size={14} />
					Retry
				</button>
			{:else}
				<button
					onclick={generateAll}
					disabled={!canGenerate || session.generationState === "generating"}
					class="bg-brand text-brand-foreground hover:bg-brand/90 flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-30"
				>
					{#if session.generationState === "generating"}
						<Loader2 size={14} class="animate-spin" />
						Generating...
					{:else}
						<Zap size={14} />
						Generate
					{/if}
				</button>
			{/if}
		</div>
	</div>
</div>
