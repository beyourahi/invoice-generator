<script lang="ts">
	import { buildInvoiceHtml, getFileName, getInvoiceId } from "$lib/invoice/builder";
	import { generatePdf } from "$lib/pdf/generator";
	import { downloadGroups, isUserAbort, type DownloadGroup } from "$lib/pdf/sequential-download";
	import { downloadInvoicesZip } from "$lib/pdf/zip";
	import { fixed } from "$lib/stores/fixed.svelte";
	import { session } from "$lib/stores/session.svelte";
	import { ACTIVE_THEME_ID, getTheme } from "$lib/themes/registry";
	import type { GeneratedInvoice } from "$lib/types";
	import Button from "$lib/components/ui/button.svelte";
	import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
	import { Progress } from "$lib/components/ui/progress";
	import * as Table from "$lib/components/ui/table";
	import { AlertCircle, Download, FileDown, FolderDown, Loader2, RotateCcw, TriangleAlert } from "@lucide/svelte";

	interface ClientGroup {
		clientId: string;
		clientName: string;
		year: number;
		folderName: string;
		invoices: GeneratedInvoice[];
	}

	let progress = $state(0);
	let busyClientId = $state<string | null>(null);
	let busyAll = $state(false);

	const totalCount = $derived(session.totalInvoiceCount);
	const canGenerate = $derived(
		session.clients.length > 0 &&
			totalCount > 0 &&
			session.allClientsValid &&
			session.generationState !== "generating"
	);

	const clientGroups = $derived.by((): ClientGroup[] => {
		const groups: ClientGroup[] = [];
		const indexById: Record<string, number> = {};
		for (const invoice of session.generatedInvoices) {
			const existingIndex = indexById[invoice.clientId];
			if (existingIndex !== undefined) {
				groups[existingIndex].invoices.push(invoice);
				continue;
			}
			indexById[invoice.clientId] = groups.length;
			groups.push({
				clientId: invoice.clientId,
				clientName: invoice.clientName,
				year: invoice.year,
				folderName: `${invoice.clientName}-${invoice.year}-Invoices`,
				invoices: [invoice]
			});
		}
		return groups;
	});

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
						clientId: client.id,
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

	const toDownloadGroup = (group: ClientGroup): DownloadGroup => ({
		folderName: group.folderName,
		invoices: group.invoices
	});

	const pluraliseFiles = (count: number) => `${count} file${count !== 1 ? "s" : ""}`;

	const describeOutcome = (
		result: { usedDirectoryPicker: boolean; fellBackToSequential: boolean; fileCount: number },
		singleFileName: string | null
	): string => {
		if (result.usedDirectoryPicker) {
			return `${pluraliseFiles(result.fileCount)} saved to selected folder.`;
		}
		if (result.fellBackToSequential) {
			return `Folder picker unavailable. ${pluraliseFiles(result.fileCount)} sent to your downloads folder.`;
		}
		if (singleFileName && result.fileCount === 1) return singleFileName;
		return `${pluraliseFiles(result.fileCount)} sent to your downloads folder.`;
	};

	const downloadGroup = async (group: ClientGroup) => {
		if (busyClientId || busyAll) return;
		busyClientId = group.clientId;
		try {
			const result = await downloadGroups([toDownloadGroup(group)]);
			if (result.cancelled) return;
			const singleName = group.invoices.length === 1 ? group.invoices[0].fileName : null;
			await notifySuccess("Download started", describeOutcome(result, singleName));
		} catch (err) {
			if (isUserAbort(err)) return;
			await notifyError(
				"Download failed",
				err instanceof Error ? err.message : "Could not save to the selected folder."
			);
		} finally {
			busyClientId = null;
		}
	};

	const downloadAll = async () => {
		if (busyAll || busyClientId) return;
		if (clientGroups.length === 0) return;
		busyAll = true;
		try {
			const result = await downloadInvoicesZip(clientGroups.map(toDownloadGroup));
			if (result.fileCount === 0) return;
			await notifySuccess(
				"Download started",
				`${pluraliseFiles(result.fileCount)} packaged into ${result.zipFileName}.`
			);
		} catch (err) {
			await notifyError(
				"Download failed",
				err instanceof Error ? err.message : "Could not package invoices into a ZIP archive."
			);
		} finally {
			busyAll = false;
		}
	};
</script>

<Card>
	<CardHeader class="border-border border-b">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<CardTitle class="text-base font-semibold">Generation</CardTitle>
				<p class="text-muted-foreground mt-1 text-xs tabular-nums">
					{session.clients.length} client{session.clients.length !== 1 ? "s" : ""} ·
					{totalCount} invoice{totalCount !== 1 ? "s" : ""}
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				{#if session.generationState === "done"}
					<Button
						class="bg-brand text-brand-foreground hover:bg-brand/90 w-full sm:w-auto"
						onclick={downloadAll}
						disabled={busyAll || busyClientId !== null || clientGroups.length === 0}
						aria-label="Download all generated invoices"
					>
						{#if busyAll}
							<Loader2 size={14} class="animate-spin" aria-hidden="true" />
							Preparing
						{:else}
							<FolderDown size={14} aria-hidden="true" />
							Download all
						{/if}
					</Button>
					<Button
						variant="outline"
						class="w-full sm:w-auto"
						onclick={session.resetGeneration}
						disabled={busyAll}
					>
						<RotateCcw size={14} aria-hidden="true" />
						Reset
					</Button>
				{:else if session.generationState === "error"}
					<Button
						class="bg-brand text-brand-foreground hover:bg-brand/90 w-full sm:w-auto"
						onclick={generateAll}
					>
						<RotateCcw size={14} aria-hidden="true" />
						Retry
					</Button>
				{:else}
					<Button
						class="bg-brand text-brand-foreground hover:bg-brand/90 w-full sm:w-auto"
						onclick={generateAll}
						disabled={!canGenerate || session.generationState === "generating"}
					>
						{#if session.generationState === "generating"}
							<Loader2 size={14} class="animate-spin" aria-hidden="true" />
							Generating
						{:else}
							<FileDown size={14} aria-hidden="true" />
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
			<div class="text-destructive flex items-center gap-2 text-xs" role="alert">
				<AlertCircle size={13} class="shrink-0" aria-hidden="true" />
				<span>{session.generationError}</span>
			</div>
		{:else if session.clients.length > 0 && !session.allClientsValid && session.generationState === "idle"}
			<div class="text-muted-foreground flex items-center gap-2 text-xs">
				<TriangleAlert size={13} class="shrink-0" aria-hidden="true" />
				<span>Every client needs a name and invoice prefix before generation.</span>
			</div>
		{:else if session.generationState === "idle"}
			<p class="text-muted-foreground text-xs">
				Add at least one valid client and invoice entry to generate PDFs.
			</p>
		{/if}

		{#if session.generationState === "done" && clientGroups.length > 0}
			<div class="border-border overflow-x-auto rounded-lg border">
				<Table.Root>
					<Table.Header>
						<Table.Row class="border-border hover:bg-transparent">
							<Table.Head class="h-9 pl-3 text-[11px] tracking-wider uppercase">Client</Table.Head>
							<Table.Head class="h-9 text-[11px] tracking-wider uppercase">Invoices</Table.Head>
							<Table.Head class="hidden h-9 text-[11px] tracking-wider uppercase sm:table-cell">
								Year
							</Table.Head>
							<Table.Head class="h-9 w-28 pr-3"></Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each clientGroups as group (group.clientId)}
							{@const isBusy = busyClientId === group.clientId}
							{@const isSingle = group.invoices.length === 1}
							<Table.Row class="border-border">
								<Table.Cell class="py-2 pl-3 text-xs font-medium">{group.clientName}</Table.Cell>
								<Table.Cell class="text-muted-foreground py-2 text-xs tabular-nums">
									{group.invoices.length}
								</Table.Cell>
								<Table.Cell
									class="text-muted-foreground hidden py-2 text-xs tabular-nums sm:table-cell"
								>
									{group.year}
								</Table.Cell>
								<Table.Cell class="py-2 pr-3 text-right">
									<Button
										size="sm"
										class="bg-brand text-brand-foreground hover:bg-brand/90 w-full sm:w-auto"
										onclick={() => downloadGroup(group)}
										disabled={isBusy || busyAll}
										aria-label={isSingle
											? `Download ${group.invoices[0].fileName}`
											: `Download ${group.invoices.length} invoices for ${group.clientName}`}
									>
										{#if isBusy}
											<Loader2 size={12} class="animate-spin" aria-hidden="true" />
										{:else}
											<Download size={12} aria-hidden="true" />
										{/if}
										<span>{isSingle ? "PDF" : "Folder"}</span>
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
