<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import { fixed } from "$lib/stores/fixed.svelte";
	import { buildInvoiceHtml, getFileName, getInvoiceId } from "$lib/invoice/builder";
	import { generatePdf } from "$lib/pdf/generator";
	import { getTheme, ACTIVE_THEME_ID } from "$lib/themes/registry";
	import { buildZip } from "$lib/pdf/zip";
	import { downloadBlob } from "$lib/utils";
	import type { GeneratedInvoice } from "$lib/types";
	import Button from "$lib/components/ui/button.svelte";
	import { Progress } from "$lib/components/ui/progress";
	import * as Table from "$lib/components/ui/table";
	import { Zap, Download, Archive, AlertCircle, RotateCcw, Loader2, TriangleAlert } from "@lucide/svelte";

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

<div class="border-border/40 mt-6 space-y-4 border-t pt-5">
	<!-- Stats row -->
	<div class="text-muted-foreground/60 flex items-center justify-between text-xs tabular-nums">
		<span>
			{session.clients.length} client{session.clients.length !== 1 ? "s" : ""} ·
			{totalCount} invoice{totalCount !== 1 ? "s" : ""}
		</span>
		{#if session.generationState === "generating"}
			<span>{progress}%</span>
		{/if}
	</div>

	<!-- Progress bar (visible only during generation) -->
	{#if session.generationState === "generating"}
		<Progress value={progress} class="h-1.5" />
	{/if}

	<!-- Status messages -->
	{#if session.generationState === "error" && session.generationError}
		<div class="text-destructive flex items-center gap-1.5 text-xs">
			<AlertCircle size={12} class="shrink-0" />
			<span class="max-w-sm truncate">{session.generationError}</span>
		</div>
	{:else if session.clients.length > 0 && !session.allClientsValid && session.generationState === "idle"}
		<div class="text-muted-foreground/60 flex items-center gap-1.5 text-xs">
			<TriangleAlert size={12} class="shrink-0" />
			<span>All clients need a name and invoice prefix to generate</span>
		</div>
	{/if}

	<!-- Generated invoices table (done state) -->
	{#if session.generationState === "done" && session.generatedInvoices.length > 0}
		<div class="border-border/40 overflow-hidden rounded-lg border">
			<Table.Root>
				<Table.Header>
					<Table.Row class="border-border/40 hover:bg-transparent">
						<Table.Head class="h-8 pl-3 text-[10px] tracking-wider uppercase">Client</Table.Head>
						<Table.Head class="h-8 text-[10px] tracking-wider uppercase">Invoice ID</Table.Head>
						<Table.Head class="h-8 text-[10px] tracking-wider uppercase">Period</Table.Head>
						<Table.Head class="h-8 w-16 pr-3"></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each session.generatedInvoices as invoice, i (invoice.fileName)}
						<Table.Row class="border-border/40">
							<Table.Cell class="py-2 pl-3 text-xs font-medium">{invoice.clientName}</Table.Cell>
							<Table.Cell class="text-muted-foreground py-2 font-mono text-xs"
								>{invoice.invoiceId}</Table.Cell
							>
							<Table.Cell class="text-muted-foreground py-2 text-xs">{invoice.year}</Table.Cell>
							<Table.Cell class="py-2 pr-3 text-right">
								<Button
									variant="ghost"
									size="sm"
									class="text-muted-foreground hover:text-foreground h-7 px-2 text-xs"
									onclick={() => downloadOne(i)}
								>
									<Download size={11} />
									PDF
								</Button>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	{/if}

	<!-- Action buttons row -->
	<div class="flex items-center justify-end gap-2">
		{#if session.generationState === "done"}
			<Button variant="outline" size="sm" onclick={session.resetGeneration}>
				<RotateCcw size={11} />
				Regenerate
			</Button>
			{#if session.generatedInvoices.length === 1}
				<Button
					size="sm"
					class="bg-brand text-brand-foreground hover:bg-brand/90"
					onclick={() => downloadOne(0)}
				>
					<Download size={13} />
					Download PDF
				</Button>
			{:else}
				<Button
					size="sm"
					class="bg-brand text-brand-foreground hover:bg-brand/90"
					onclick={downloadAll}
					disabled={zipping}
				>
					<Archive size={13} />
					{zipping ? "Zipping..." : "Download ZIP"}
				</Button>
			{/if}
		{:else if session.generationState === "error"}
			<Button size="sm" class="bg-brand text-brand-foreground hover:bg-brand/90" onclick={generateAll}>
				<RotateCcw size={13} />
				Retry
			</Button>
		{:else}
			<Button
				size="sm"
				class="bg-brand text-brand-foreground hover:bg-brand/90 disabled:opacity-30"
				onclick={generateAll}
				disabled={!canGenerate || session.generationState === "generating"}
			>
				{#if session.generationState === "generating"}
					<Loader2 size={13} class="animate-spin" />
					Generating...
				{:else}
					<Zap size={13} />
					Generate{totalCount > 0 ? ` (${totalCount})` : ""}
				{/if}
			</Button>
		{/if}
	</div>
</div>
