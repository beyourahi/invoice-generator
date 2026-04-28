<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLTextareaAttributes } from "svelte/elements";

	let {
		class: className = "",
		value = $bindable(""),
		...props
	}: {
		class?: string;
		value?: string;
	} & HTMLTextareaAttributes = $props();
</script>

<textarea
	class={cn(
		"w-full min-h-16 rounded-xl border border-border bg-input px-3 py-2 text-sm",
		"text-foreground placeholder:text-muted-foreground resize-none",
		"transition-colors duration-150",
		"focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-0",
		"focus-visible:border-ring/50",
		"disabled:opacity-40 disabled:cursor-not-allowed",
		className
	)}
	bind:value
	{...props}
></textarea>
