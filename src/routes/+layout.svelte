<script lang="ts">
	import "../app.css";
	import { fixed } from "$lib/stores/fixed.svelte";
	import { onMount } from "svelte";

	let { children } = $props();

	onMount(() => {
		fixed.init();
	});
</script>

{@render children()}
