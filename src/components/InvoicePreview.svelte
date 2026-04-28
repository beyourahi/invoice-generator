<script lang="ts">
	import { FileText } from "@lucide/svelte";
	import { gsap } from "gsap";

	let { html, loading }: { html: string | null; loading: boolean } = $props();

	let containerEl = $state<HTMLDivElement | undefined>(undefined);
	let containerWidth = $state(0);

	const scale = $derived(containerWidth > 0 ? containerWidth / 794 : 1);
	const scaledHeight = $derived(Math.round(1123 * scale));

	$effect(() => {
		if (html && containerEl) {
			gsap.fromTo(containerEl, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" });
		}
	});
</script>

<div class="flex h-full flex-col">
	{#if loading}
		<div class="border-border/40 bg-card min-h-[200px] flex-1 animate-pulse rounded-xl border"></div>
	{:else if !html}
		<div
			class="border-border/40 bg-card/20 flex min-h-[200px] flex-1 flex-col items-center justify-center gap-4 rounded-xl border"
		>
			<div class="border-border/40 bg-muted/30 flex h-12 w-12 items-center justify-center rounded-xl border">
				<FileText size={20} class="text-muted-foreground/30" />
			</div>
			<div class="space-y-1 text-center">
				<p class="text-muted-foreground/50 text-xs font-medium">invoice preview</p>
				<p class="text-muted-foreground/30 text-[11px]">select a client to preview</p>
			</div>
		</div>
	{:else}
		<div
			bind:this={containerEl}
			bind:clientWidth={containerWidth}
			class="border-border/40 overflow-hidden rounded-xl border bg-white"
			style="height: {scaledHeight}px"
		>
			{#if containerWidth > 0}
				<iframe
					srcdoc={html}
					title="invoice preview"
					style="width: 794px; height: 1123px; transform: scale({scale}); transform-origin: top left; border: none; display: block;"
				></iframe>
			{/if}
		</div>
	{/if}
</div>
