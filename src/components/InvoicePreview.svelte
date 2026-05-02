<script lang="ts">
	import { cn } from "$lib/utils";
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import { FileText, ScanLine } from "@lucide/svelte";

	let { html, loading }: { html: string | null; loading: boolean } = $props();

	let containerWidth = $state(0);

	const scale = $derived(containerWidth > 0 ? Math.min(containerWidth / 794, 1) : 1);
	const scaledHeight = $derived(`${Math.round(1123 * scale)}px`);
	const previewScale = $derived(String(scale));

	const measurePreview = (node: HTMLDivElement) => {
		let frame = 0;

		const updateContainerWidth = () => {
			containerWidth = node.clientWidth;
		};

		frame = requestAnimationFrame(updateContainerWidth);
		window.addEventListener("resize", updateContainerWidth);

		return {
			destroy: () => {
				cancelAnimationFrame(frame);
				window.removeEventListener("resize", updateContainerWidth);
			}
		};
	};
</script>

<Card size="sm" class="gap-0 py-0">
	<CardHeader class="border-border border-b">
		<div class="flex items-center justify-between gap-3">
			<div>
				<CardTitle class="flex items-center gap-2 text-base font-semibold">
					<ScanLine size={15} aria-hidden="true" />
					Preview
				</CardTitle>
				<CardDescription class="text-xs">First scheduled invoice for the selected client.</CardDescription>
			</div>
			{#if html}
				<span class="bg-muted text-muted-foreground rounded-md px-2 py-1 font-mono text-[11px]">A4</span>
			{/if}
		</div>
	</CardHeader>
	<CardContent class={cn("p-0", !html && !loading && "p-4")}>
		{#if loading}
			<div class="space-y-3 p-4" aria-live="polite">
				<Skeleton class="h-4 w-3/4" />
				<Skeleton class="h-4 w-1/2" />
				<Skeleton class="h-64 w-full" />
				<Skeleton class="h-4 w-2/3" />
				<Skeleton class="h-4 w-1/3" />
			</div>
		{:else if !html}
			<div
				class="border-border text-muted-foreground grid min-h-72 place-items-center rounded-lg border border-dashed text-center"
			>
				<div class="space-y-2">
					<div class="bg-muted mx-auto flex size-10 items-center justify-center rounded-lg">
						<FileText size={17} aria-hidden="true" />
					</div>
					<p class="text-sm font-medium">No preview available</p>
					<p class="max-w-56 text-xs">Select a client with at least one invoice entry.</p>
				</div>
			</div>
		{:else}
			<div class="max-h-[calc(100dvh-8rem)] overflow-auto lg:max-h-[calc(100dvh-6rem)]">
				<div
					use:measurePreview
					class="invoice-preview-stage overflow-hidden"
					style:--preview-height={scaledHeight}
					style:--preview-scale={previewScale}
				>
					{#if containerWidth > 0}
						<iframe srcdoc={html} title="Invoice preview" class="invoice-preview-frame"></iframe>
					{/if}
				</div>
			</div>
		{/if}
	</CardContent>
</Card>
