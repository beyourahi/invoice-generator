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
		"border-border bg-input/30 text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2.5 text-sm",
		"transition-colors duration-200 outline-none",
		"focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
		"disabled:cursor-not-allowed disabled:opacity-50",
		className
	)}
	bind:value
	{...props}
/>
