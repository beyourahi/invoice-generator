<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLInputAttributes } from "svelte/elements";

	let {
		class: className = "",
		value = $bindable(""),
		...props
	}: {
		class?: string;
		value?: string | number;
	} & HTMLInputAttributes = $props();
</script>

<input
	class={cn(
		"border-border bg-input h-9 w-full rounded-xl border px-3 text-sm",
		"text-foreground placeholder:text-muted-foreground",
		"transition-colors duration-150",
		"focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-0",
		"focus-visible:border-ring/50",
		"disabled:cursor-not-allowed disabled:opacity-40",
		className
	)}
	bind:value
	{...props}
/>
