<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLLabelAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	let {
		class: className = "",
		children,
		...props
	}: {
		class?: string;
		children?: Snippet;
	} & HTMLLabelAttributes = $props();
</script>

<label
	class={cn(
		"block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5",
		className
	)}
	{...props}
>
	{@render children?.()}
</label>
