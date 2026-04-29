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
		"min-h-16 w-full rounded-lg border bg-zinc-800/50 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500",
		"resize-none",
		"transition-all duration-200",
		"focus:ring-2 focus:ring-brand/50 focus:outline-none",
		"border-zinc-700 focus:border-brand/50",
		"disabled:cursor-not-allowed disabled:opacity-50",
		className
	)}
	bind:value
	{...props}
></textarea>
