<!--
	Root layout. Owns the global app shell, cross-route View Transitions, and the
	AI Copilot mount. Copilot is gated to the home route only: `data.aiEnabled`
	(feature flag) AND route id `/` AND no active error. Desktop (lg+) renders a
	fixed right-rail <aside> with AiSidebar; mobile gets AiMobileFab +
	AiMobileSheet; AiConfirmDialog mounts globally for Tier-B confirmations.
	When the rail shows, the main column reserves space via lg:pr-[26rem].
-->
<script lang="ts">
	import "../app.css";
	import type { Snippet } from "svelte";
	import { page } from "$app/state";
	import { onNavigate } from "$app/navigation";
	import { handleViewTransition } from "$lib/motion";
	import { Footer } from "$lib/components/ui/footer";
	import AiSidebar from "$src/components/ai/AiSidebar.svelte";
	import AiConfirmDialog from "$src/components/ai/AiConfirmDialog.svelte";
	import AiMobileFab from "$src/components/ai/AiMobileFab.svelte";
	import AiMobileSheet from "$src/components/ai/AiMobileSheet.svelte";
	import type { LayoutData } from "./$types";

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	// Wires cross-route View Transitions; no-ops when the API is unavailable or motion is reduced.
	onNavigate(handleViewTransition);

	const showCopilot = $derived(data.aiEnabled && page.route.id === "/" && !page.error);
</script>

<svelte:head>
	<title>Invoice Generator</title>
	<meta name="description" content="Client-side batch invoice PDF generator for recurring billing." />
</svelte:head>

<div class={["flex min-h-dvh flex-col", showCopilot && "lg:pr-[calc(26rem+1.5rem)] xl:pr-[calc(28rem+1.5rem)]"]}>
	<div class="flex grow flex-col">
		{@render children()}
	</div>
	<Footer />
</div>

{#if showCopilot}
	<aside class="fixed top-0 right-0 z-40 hidden h-dvh p-2.5 lg:block lg:w-[26rem] xl:w-[28rem]">
		<AiSidebar />
	</aside>

	<AiMobileFab />
	<AiMobileSheet />
	<AiConfirmDialog />
{/if}
