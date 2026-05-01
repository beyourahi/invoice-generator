<script lang="ts">
	import "../app.css";
	import { Footer } from "$lib/components/ui/footer";

	let { children } = $props();
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
