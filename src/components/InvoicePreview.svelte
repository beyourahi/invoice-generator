<!--
	Live scaled preview of the first generatable invoice for the selected client, rendered
	into an isolated iframe via srcdoc. Width presets + fullscreen are previewer chrome only —
	they never affect the generated PDF (which is always A4). Parent supplies the html + empty reason.
-->
<script lang="ts">
	import { cn } from "$lib/utils";
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import { Button } from "$lib/components/ui/button";
	import { Eyebrow } from "$lib/ds";
	import StatusBadge from "$src/components/StatusBadge.svelte";
	import {
		FileText,
		ScanLine,
		Maximize2,
		Minimize2,
		Monitor,
		Laptop,
		Tablet,
		Smartphone,
		MoveHorizontal
	} from "@lucide/svelte";
	import { onMount } from "svelte";
	import { getGsap, prefersReducedMotion, DURATION } from "$lib/motion";
	import type { GsapBundle } from "$lib/motion";

	type EmptyReason = "no-client" | "no-entries" | "no-active";

	let {
		html,
		loading,
		emptyReason = "no-client"
	}: { html: string | null; loading: boolean; emptyReason?: EmptyReason } = $props();

	type WidthPreset = "fit" | "1440" | "1280" | "768" | "375";

	type WidthPresetDef = {
		value: WidthPreset;
		label: string;
		icon: typeof Monitor;
		px: number | null;
	};

	const WIDTH_PRESETS: readonly WidthPresetDef[] = [
		{ value: "fit", label: "Fit to browser", icon: MoveHorizontal, px: null },
		{ value: "1440", label: "Desktop (1440px)", icon: Monitor, px: 1440 },
		{ value: "1280", label: "Laptop (1280px)", icon: Laptop, px: 1280 },
		{ value: "768", label: "Tablet (768px)", icon: Tablet, px: 768 },
		{ value: "375", label: "Mobile (375px)", icon: Smartphone, px: 375 }
	];

	const WIDTH_STORAGE_KEY = "invoice-gen:preview-width";

	type FullscreenDocument = Document & {
		webkitFullscreenElement?: Element | null;
		webkitExitFullscreen?: () => Promise<void> | void;
	};
	type FullscreenElement = HTMLElement & {
		webkitRequestFullscreen?: () => Promise<void> | void;
	};

	let containerWidth = $state(0);
	let fullscreenRoot: HTMLDivElement;
	let isFullscreen = $state(false);
	let widthPreset = $state<WidthPreset>("fit");
	let previewFrame = $state<HTMLIFrameElement | null>(null);

	// 794 = A4 width in px at the invoice's render DPI. Scale fits the page to the stage, capped at 1:1.
	const scale = $derived(containerWidth > 0 ? Math.min(containerWidth / 794, 1) : 1);
	const scaledHeight = $derived(`${Math.round(1123 * scale)}px`);
	const previewScale = $derived(String(scale));
	const currentPreset = $derived(WIDTH_PRESETS.find(p => p.value === widthPreset) ?? WIDTH_PRESETS[0]);
	const presetWidth = $derived(currentPreset.px ? `${currentPreset.px}px` : "100%");

	// Svelte action: tracks the stage width via ResizeObserver to drive the scale factor.
	// rAF on attach avoids reading a zero width before first layout. Disconnects on destroy.
	const measurePreview = (node: HTMLDivElement) => {
		let frame = 0;

		const updateContainerWidth = () => {
			containerWidth = node.clientWidth;
		};

		frame = requestAnimationFrame(updateContainerWidth);
		const observer = new ResizeObserver(updateContainerWidth);
		observer.observe(node);

		return {
			destroy: () => {
				cancelAnimationFrame(frame);
				observer.disconnect();
			}
		};
	};

	const isWidthPreset = (value: string): value is WidthPreset => WIDTH_PRESETS.some(p => p.value === value);

	const loadWidthPreset = (): WidthPreset => {
		if (typeof localStorage === "undefined") return "fit";
		try {
			const raw = localStorage.getItem(WIDTH_STORAGE_KEY);
			if (raw && isWidthPreset(raw)) return raw;
		} catch {
			// SecurityError / quota: fall back to default.
		}
		return "fit";
	};

	const saveWidthPreset = (value: WidthPreset) => {
		if (typeof localStorage === "undefined") return;
		try {
			localStorage.setItem(WIDTH_STORAGE_KEY, value);
		} catch {
			// SecurityError / quota: width preset is non-critical — drop silently.
		}
	};

	const selectWidth = (value: WidthPreset) => {
		widthPreset = value;
		saveWidthPreset(value);
	};

	// Fullscreen API with WebKit vendor-prefix fallbacks throughout; state stays in sync via the
	// fullscreenchange listeners in onMount rather than being assumed from the request promise.
	const getFullscreenElement = (): Element | null => {
		if (typeof document === "undefined") return null;
		const doc = document as FullscreenDocument;
		return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
	};

	const enterFullscreen = async () => {
		const el = fullscreenRoot as FullscreenElement;
		const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
		if (!request) return;
		try {
			await request.call(el);
		} catch {
			// User-gesture or permission rejection; stay windowed.
		}
	};

	const exitFullscreen = async () => {
		const doc = document as FullscreenDocument;
		const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen;
		if (!exit) return;
		try {
			await exit.call(doc);
		} catch {
			// Already exiting; state will resync via fullscreenchange listener.
		}
	};

	const toggleFullscreen = () => {
		if (getFullscreenElement()) exitFullscreen();
		else enterFullscreen();
	};

	onMount(() => {
		widthPreset = loadWidthPreset();

		const sync = () => {
			isFullscreen = getFullscreenElement() === fullscreenRoot;
		};
		sync();
		document.addEventListener("fullscreenchange", sync);
		document.addEventListener("webkitfullscreenchange", sync);

		return () => {
			document.removeEventListener("fullscreenchange", sync);
			document.removeEventListener("webkitfullscreenchange", sync);
		};
	});

	// Fade the iframe in whenever the html changes (re-runs because `void html` is tracked).
	// Skipped entirely under reduced motion. Tween is killed on cleanup / re-run.
	$effect(() => {
		void html;
		const frame = previewFrame;
		if (!frame || prefersReducedMotion.current) return;

		let bundle: GsapBundle | null = null;
		let cancelled = false;

		getGsap().then(loaded => {
			if (cancelled || !loaded) return;
			bundle = loaded;
			bundle.gsap.fromTo(frame, { opacity: 0.55 }, { opacity: 1, duration: DURATION.fast });
		});

		return () => {
			cancelled = true;
			bundle?.gsap.killTweensOf(frame);
		};
	});
</script>

<div bind:this={fullscreenRoot} class={cn("w-full", isFullscreen && "bg-background fixed inset-0 z-50 flex flex-col")}>
	<Card size="sm" class={cn("gap-0 py-0", isFullscreen && "h-full rounded-none border-0")}>
		<CardHeader class="border-hair border-b">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="min-w-0">
					<CardTitle>
						<span class="flex items-center gap-2">
							<ScanLine size={13} class="text-ink-muted" aria-hidden="true" />
							<Eyebrow as="span">Preview</Eyebrow>
						</span>
					</CardTitle>
					<CardDescription class="mt-1.5 text-xs text-pretty">
						First scheduled invoice for the selected client.
					</CardDescription>
				</div>
				{#if html}
					<div class="flex items-center gap-2">
						<div
							role="group"
							aria-label="Preview width"
							class="border-hair bg-ink-2/40 flex items-center gap-0.5 rounded-full border p-0.5"
						>
							{#each WIDTH_PRESETS as preset (preset.value)}
								{@const Icon = preset.icon}
								<button
									type="button"
									onclick={() => selectWidth(preset.value)}
									aria-label={preset.label}
									aria-pressed={widthPreset === preset.value}
									class={cn(
										"focus-visible:outline-signal grid size-11 touch-manipulation place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:size-8",
										widthPreset === preset.value
											? "bg-signal text-background"
											: "text-ink-muted hover:text-foreground"
									)}
								>
									<Icon size={14} aria-hidden="true" />
								</button>
							{/each}
						</div>
						<span
							class="border-hair text-ink-muted hidden rounded-full border px-2.5 py-1 font-mono text-micro tracking-wider whitespace-nowrap uppercase sm:inline"
						>
							A4
						</span>
						<Button
							variant="ghost"
							size="icon-lg"
							class="touch-manipulation rounded-full"
							aria-label={isFullscreen ? "Exit fullscreen" : "View fullscreen"}
							onclick={toggleFullscreen}
						>
							{#if isFullscreen}
								<Minimize2 aria-hidden="true" />
							{:else}
								<Maximize2 aria-hidden="true" />
							{/if}
						</Button>
					</div>
				{/if}
			</div>
		</CardHeader>
		<CardContent class={cn("p-0", !html && !loading && "p-4", isFullscreen && "flex min-h-0 flex-1 flex-col")}>
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
					class="border-hair text-ink-muted grid min-h-72 place-items-center rounded-xl border border-dashed text-center"
				>
					<div class="flex flex-col items-center gap-2">
						<div class="bg-ink-2 mx-auto flex size-10 items-center justify-center rounded-xl">
							<FileText size={17} aria-hidden="true" />
						</div>
						{#if emptyReason === "no-active"}
							<StatusBadge status="inactive" size="sm" />
							<p class="text-sm font-medium text-balance">No active invoice to preview</p>
							<p class="max-w-56 text-xs text-pretty">
								The selected client has no active invoices. Activate at least one entry.
							</p>
						{:else if emptyReason === "no-entries"}
							<p class="text-sm font-medium text-balance">No preview available</p>
							<p class="max-w-56 text-xs text-pretty">Add at least one invoice entry to this client.</p>
						{:else}
							<p class="text-sm font-medium text-balance">No preview available</p>
							<p class="max-w-56 text-xs text-pretty">Select a client with at least one invoice entry.</p>
						{/if}
					</div>
				</div>
			{:else}
				<div
					class={cn(
						"overflow-auto",
						isFullscreen ? "h-full" : "max-h-[calc(100dvh-8rem)] lg:max-h-[calc(100dvh-6rem)]"
					)}
				>
					<div
						use:measurePreview
						class="invoice-preview-stage mx-auto overflow-hidden"
						style:--preview-height={scaledHeight}
						style:--preview-scale={previewScale}
						style:width={presetWidth}
					>
						<!-- Mount the iframe only after a width is measured, so the initial scale is correct. -->
						{#if containerWidth > 0}
							<iframe
								bind:this={previewFrame}
								srcdoc={html}
								title="Invoice preview"
								class="invoice-preview-frame"
							></iframe>
						{/if}
					</div>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
