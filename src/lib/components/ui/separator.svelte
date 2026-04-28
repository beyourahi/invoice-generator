<script lang="ts">
	import { cn } from "$lib/utils";

	let { class: className = "" }: { class?: string } = $props();
</script>

<div class={cn("h-px w-full bg-border/60", className)}></div>
