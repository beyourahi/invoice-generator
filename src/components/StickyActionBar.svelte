<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import { fixed } from "$lib/stores/fixed.svelte";
	import { buildInvoiceHtml, getFileName, getInvoiceId } from "$lib/invoice/builder";
	import { generatePdf } from "$lib/pdf/generator";
	import { getTheme, ACTIVE_THEME_ID } from "$lib/themes/registry";
	import { buildZip } from "$lib/pdf/zip";
	import { downloadBlob } from "$lib/utils";
	import type { GeneratedInvoice } from "$lib/types";
	import { Zap, Download, Archive, AlertCircle, TriangleAlert, RotateCcw, Loader2 } from "@lucide/svelte";

	let progress = $state(0);
	let zipping = $state(false);

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

<div class="border-border/40 mt-6 border-t pt-5">
	<div class="flex items-center justify-between">
		<!-- Stats -->
		<p class="text-muted-foreground/60 text-xs tabular-nums">
			{session.clients.length} client{session.clients.length !== 1 ? "s" : ""} ·
			{totalCount} invoice{totalCount !== 1 ? "s" : ""}
		</p>

		<!-- Status + actions -->
		<div class="flex items-center gap-3">
			{#if session.generationState === "generating"}
				<div class="flex items-center gap-2">
					<div class="bg-secondary h-1.5 w-28 overflow-hidden rounded-full">
						<div
							class="bg-brand h-full rounded-full transition-all duration-300 ease-out"
							style="width: {progress}%"
						></div>
					</div>
					<span class="text-muted-foreground w-8 text-right text-xs tabular-nums">{progress}%</span>
				</div>
			{:else if session.generationState === "error" && session.generationError}
				<div class="flex items-center gap-1.5">
					<AlertCircle size={12} class="text-destructive shrink-0" />
					<p class="text-destructive max-w-[240px] truncate text-xs">{session.generationError}</p>
				</div>
			{:else if session.clients.length > 0 && !session.allClientsValid}
				<div class="flex items-center gap-1.5">
					<TriangleAlert size={12} class="text-destructive/70 shrink-0" />
					<p class="text-destructive/70 text-xs">all clients need a name and invoice prefix</p>
				</div>
			{:else if session.generationState === "done"}
				<p class="text-muted-foreground/50 text-xs">
					{session.generatedInvoices.length} invoice{session.generatedInvoices.length !== 1
						? "s"
						: ""} ready
				</p>
			{/if}

			{#if session.generationState === "done"}
				<button
					onclick={session.resetGeneration}
					class="border-border/60 text-muted-foreground hover:border-border hover:text-foreground flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs transition-colors"
				>
					<RotateCcw size={11} />
					Regenerate
				</button>
				{#if session.generatedInvoices.length === 1}
					<button
						onclick={() => downloadOne(0)}
						class="bg-brand text-brand-foreground hover:bg-brand/90 flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors active:scale-[0.98]"
					>
						<Download size={13} />
						Download PDF
					</button>
				{:else}
					<button
						onclick={downloadAll}
						disabled={zipping}
						class="bg-brand text-brand-foreground hover:bg-brand/90 flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors active:scale-[0.98] disabled:opacity-50"
					>
						<Archive size={13} />
						{zipping ? "Zipping..." : "Download ZIP"}
					</button>
				{/if}
			{:else if session.generationState === "error"}
				<button
					onclick={generateAll}
					class="bg-brand text-brand-foreground hover:bg-brand/90 flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors"
				>
					<RotateCcw size={13} />
					Retry
				</button>
			{:else}
				<button
					onclick={generateAll}
					disabled={!canGenerate || session.generationState === "generating"}
					class="bg-brand text-brand-foreground hover:bg-brand/90 flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-30"
				>
					{#if session.generationState === "generating"}
						<Loader2 size={13} class="animate-spin" />
						Generating...
					{:else}
						<Zap size={13} />
						Generate
					{/if}
				</button>
			{/if}
		</div>
	</div>
</div>
