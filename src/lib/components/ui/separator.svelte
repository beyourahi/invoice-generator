<script lang="ts">
	import { cn } from "$lib/utils";

	let { class: className = "" }: { class?: string } = $props();
</script>

<div class={cn("bg-border h-px w-full", className)}></div>
