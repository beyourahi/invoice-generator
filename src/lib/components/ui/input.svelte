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
		"transition-all duration-200",
		"focus:ring-brand/50 focus:ring-2 focus:outline-none",
		"focus:border-brand/50",
		"disabled:cursor-not-allowed disabled:opacity-50",
		className
	)}
	bind:value
	{...props}
/>
