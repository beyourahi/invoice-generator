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

<div bind:this={panelEl} class="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
	<div class="flex items-center gap-2">
		<CheckCircle size={14} class="text-primary" />
		<span class="text-sm font-medium">
			{session.generatedInvoices.length} invoice{session.generatedInvoices.length !== 1
				? "s"
				: ""} ready
		</span>
	</div>

	<div class="space-y-1.5 max-h-64 overflow-y-auto pr-1">
		{#each session.generatedInvoices as invoice, i (invoice.invoiceId)}
			<button
				onclick={() => downloadOne(i)}
				class="w-full flex items-center gap-3 rounded-xl px-3 py-2.5
                       hover:bg-accent/40 transition-colors group text-left"
			>
				<FileText size={13} class="text-muted-foreground shrink-0" />
				<span class="flex-1 min-w-0 text-xs truncate tabular-nums text-foreground/80">
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
			class="w-full h-10 rounded-xl border border-border/60 bg-transparent
                   flex items-center justify-center gap-2 text-sm font-medium text-foreground/70
                   hover:bg-accent/30 hover:text-foreground
                   active:scale-[0.98] transition-all duration-150
                   disabled:opacity-40 disabled:cursor-not-allowed"
		>
			<Archive size={14} />
			{zipping ? "creating zip..." : "download all as zip"}
		</button>
	{/if}
</div>
