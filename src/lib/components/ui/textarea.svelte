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
		"border-border bg-input/30 text-foreground placeholder:text-muted-foreground min-h-16 w-full rounded-lg border px-3 py-2.5 text-sm",
		"resize-none",
		"transition-all duration-200",
		"focus:ring-brand/50 focus:ring-2 focus:outline-none",
		"focus:border-brand/50",
		"disabled:cursor-not-allowed disabled:opacity-50",
		className
	)}
	bind:value
	{...props}
></textarea>
