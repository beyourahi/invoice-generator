<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import { buildZip } from "$lib/pdf/zip";
	import { downloadBlob } from "$lib/utils";
	import Separator from "$lib/components/ui/separator.svelte";
	import { Download, FileText, Archive, CheckCircle } from "@lucide/svelte";
	import { onMount } from "svelte";
	import { gsap } from "gsap";

	let panelEl: HTMLDivElement;
	let zipping = $state(false);

	onMount(() => {
		gsap.from(panelEl, {
			opacity: 0,
			y: 20,
			duration: 0.4,
			ease: "power3.out"
		});
	});

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

<div bind:this={panelEl} class="border-border/60 bg-card space-y-4 rounded-2xl border p-5">
	<div class="flex items-center gap-2">
		<CheckCircle size={14} class="text-primary" />
		<span class="text-sm font-medium">
			{session.generatedInvoices.length} invoice{session.generatedInvoices.length !== 1 ? "s" : ""} ready
		</span>
	</div>

	<div class="max-h-64 space-y-1.5 overflow-y-auto pr-1">
		{#each session.generatedInvoices as invoice, i (invoice.invoiceId)}
			<button
				onclick={() => downloadOne(i)}
				class="hover:bg-accent/40 group flex w-full items-center gap-3 rounded-xl
                       px-3 py-2.5 text-left transition-colors"
			>
				<FileText size={13} class="text-muted-foreground shrink-0" />
				<span class="text-foreground/80 min-w-0 flex-1 truncate text-xs tabular-nums">
					{invoice.invoiceId}
				</span>
				<Download
					size={12}
					class="text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors"
				/>
			</button>
		{/each}
	</div>

	{#if session.generatedInvoices.length > 1}
		<Separator />
		<button
			onclick={downloadAll}
			disabled={zipping}
			class="border-border/60 text-foreground/70 hover:bg-accent/30 hover:text-foreground flex h-10
                   w-full items-center justify-center gap-2 rounded-xl border bg-transparent
                   text-sm font-medium
                   transition-all duration-150 active:scale-[0.98]
                   disabled:cursor-not-allowed disabled:opacity-40"
		>
			<Archive size={14} />
			{zipping ? "creating zip..." : "download all as zip"}
		</button>
	{/if}
</div>
