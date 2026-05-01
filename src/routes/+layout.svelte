<script lang="ts">
	import "../app.css";
	import { fixed } from "$lib/stores/fixed.svelte";
	import { session } from "$lib/stores/session.svelte";
	import { Footer } from "$lib/components/ui/footer";
	import { onMount } from "svelte";

	let { children } = $props();

	onMount(() => {
		fixed.init();
		session.init();
	});
</script>

<svelte:head>
	<title>Invoice Generator</title>
	<meta name="description" content="Client-side batch invoice PDF generator for recurring billing." />
</svelte:head>

<div class="flex min-h-dvh flex-col">
	<main class="flex grow flex-col">
		{@render children()}
	</main>
	<Footer />
</div>
