<script lang="ts">
	import { buildInvoiceHtml, getFileName, getInvoiceId } from "$lib/invoice/builder";
	import { generatePdf } from "$lib/pdf/generator";
	import { buildZip } from "$lib/pdf/zip";
	import { fixed } from "$lib/stores/fixed.svelte";
	import { session } from "$lib/stores/session.svelte";
	import { ACTIVE_THEME_ID, getTheme } from "$lib/themes/registry";
	import type { GeneratedInvoice } from "$lib/types";
	import { downloadBlob } from "$lib/utils";
	import Button from "$lib/components/ui/button.svelte";
	import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
	import { Progress } from "$lib/components/ui/progress";
	import * as Table from "$lib/components/ui/table";
	import { AlertCircle, Archive, Download, FileDown, Loader2, RotateCcw, TriangleAlert } from "@lucide/svelte";

	let progress = $state(0);
	let zipping = $state(false);

	const totalCount = $derived(session.totalInvoiceCount);
	const canGenerate = $derived(
		session.clients.length > 0 &&
			totalCount > 0 &&
			session.allClientsValid &&
			session.generationState !== "generating"
	);
	const notifySuccess = async (message: string, description?: string) => {
		const { toast } = await import("svelte-sonner");
		toast.success(message, description ? { description } : undefined);
	};
	const notifyError = async (message: string, description?: string) => {
		const { toast } = await import("svelte-sonner");
		toast.error(message, description ? { description } : undefined);
	};

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
					const message = err instanceof Error ? err.message : "Generation failed";
					session.setError(message);
					await notifyError("Generation failed", message);
					return;
				}
			}
		}

		session.setGenerated(results);
		await notifySuccess(
			"Invoices generated",
			`${results.length} PDF${results.length !== 1 ? "s" : ""} ready to download.`
		);
	};

	const downloadOne = (index: number) => {
		const invoice = session.generatedInvoices[index];
		if (!invoice) return;
		downloadBlob(invoice.pdfBlob, invoice.fileName);
		void notifySuccess("PDF download started", invoice.fileName);
	};

	const downloadAll = async () => {
		zipping = true;
		try {
			const zip = await buildZip(session.generatedInvoices);
			downloadBlob(zip, "invoices.zip");
			await notifySuccess("ZIP download started", "invoices.zip");
		} catch (err) {
			await notifyError("ZIP failed", err instanceof Error ? err.message : "Could not package invoices.");
		} finally {
			zipping = false;
		}
	};
</script>

<Card>
	<CardHeader class="border-border border-b">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<CardTitle class="text-sm">Generation</CardTitle>
				<p class="text-muted-foreground mt-1 text-xs tabular-nums">
					{session.clients.length} client{session.clients.length !== 1 ? "s" : ""} ·
					{totalCount} invoice{totalCount !== 1 ? "s" : ""}
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				{#if session.generationState === "done"}
					<Button variant="outline" size="sm" onclick={session.resetGeneration}>
						<RotateCcw size={12} />
						Reset
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
							{#if zipping}
								<Loader2 size={13} class="animate-spin" />
								Zipping
							{:else}
								<Archive size={13} />
								Download ZIP
							{/if}
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
							Generating
						{:else}
							<FileDown size={13} />
							Generate{totalCount > 0 ? ` (${totalCount})` : ""}
						{/if}
					</Button>
				{/if}
			</div>
		</div>
	</CardHeader>
	<CardContent class="space-y-4">
		{#if session.generationState === "generating"}
			<div class="space-y-2" aria-live="polite">
				<div class="text-muted-foreground flex justify-between text-xs tabular-nums">
					<span>Rendering PDFs sequentially</span>
					<span>{progress}%</span>
				</div>
				<Progress value={progress} class="h-1.5" />
			</div>
		{/if}

		{#if session.generationState === "error" && session.generationError}
			<div class="text-destructive flex items-center gap-2 text-xs">
				<AlertCircle size={13} class="shrink-0" />
				<span>{session.generationError}</span>
			</div>
		{:else if session.clients.length > 0 && !session.allClientsValid && session.generationState === "idle"}
			<div class="text-muted-foreground flex items-center gap-2 text-xs">
				<TriangleAlert size={13} class="shrink-0" />
				<span>Every client needs a name and invoice prefix before generation.</span>
			</div>
		{:else if session.generationState === "idle"}
			<p class="text-muted-foreground text-xs">
				Add at least one valid client and invoice entry to generate PDFs.
			</p>
		{/if}

		{#if session.generationState === "done" && session.generatedInvoices.length > 0}
			<div class="border-border overflow-hidden rounded-lg border">
				<Table.Root>
					<Table.Header>
						<Table.Row class="border-border hover:bg-transparent">
							<Table.Head class="h-9 pl-3 text-[10px] tracking-wider uppercase">Client</Table.Head>
							<Table.Head class="h-9 text-[10px] tracking-wider uppercase">Invoice ID</Table.Head>
							<Table.Head class="hidden h-9 text-[10px] tracking-wider uppercase sm:table-cell">
								Year
							</Table.Head>
							<Table.Head class="h-9 w-12 pr-3 sm:w-20"></Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each session.generatedInvoices as invoice, i (invoice.fileName)}
							<Table.Row class="border-border">
								<Table.Cell class="py-2 pl-3 text-xs font-medium">{invoice.clientName}</Table.Cell>
								<Table.Cell class="text-muted-foreground py-2 font-mono text-xs">
									{invoice.invoiceId}
								</Table.Cell>
								<Table.Cell
									class="text-muted-foreground hidden py-2 text-xs tabular-nums sm:table-cell"
								>
									{invoice.year}
								</Table.Cell>
								<Table.Cell class="py-2 pr-3 text-right">
									<Button
										variant="ghost"
										size="sm"
										class="text-muted-foreground hover:text-foreground h-7 px-2 text-xs"
										onclick={() => downloadOne(i)}
										aria-label={`Download ${invoice.fileName}`}
									>
										<Download size={11} />
										<span class="hidden sm:inline">PDF</span>
									</Button>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
		{/if}
	</CardContent>
</Card>
