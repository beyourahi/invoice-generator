<script lang="ts">
	import "../app.css";
	import { fixed } from "$lib/stores/fixed.svelte";
	import { onMount } from "svelte";

	let { children } = $props();

	onMount(() => {
		fixed.init();
	});
</script>

<svelte:head>
	<title>Invoice Generator</title>
	<meta name="description" content="Client-side batch invoice PDF generator for recurring billing." />
</svelte:head>

{@render children()}
