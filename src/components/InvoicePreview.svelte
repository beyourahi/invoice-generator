<script lang="ts">
	import { cn } from "$lib/utils";
	import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";

	let { html, loading }: { html: string | null; loading: boolean } = $props();

	let containerEl = $state<HTMLDivElement | undefined>(undefined);
	let containerWidth = $state(0);

	const scale = $derived(containerWidth > 0 ? containerWidth / 794 : 1);
	const scaledHeight = $derived(Math.round(1123 * scale));
</script>

<Card class="gap-0 py-0">
	<CardHeader class="border-border/40 border-b px-4 py-3">
		<CardTitle class="text-sm">Preview</CardTitle>
	</CardHeader>
	<CardContent class={cn("p-0", !html && !loading && "px-4 py-8")}>
		{#if loading}
			<div class="bg-muted/40 h-48 w-full animate-pulse"></div>
		{:else if !html}
			<p class="text-muted-foreground/50 text-xs">Select a client to preview</p>
		{:else}
			<div
				bind:this={containerEl}
				bind:clientWidth={containerWidth}
				class="bg-white"
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
	</CardContent>
</Card>
