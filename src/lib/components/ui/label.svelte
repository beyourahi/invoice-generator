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

<label class={cn("mb-1.5 block text-xs font-medium text-zinc-400", className)} {...props}>
	{@render children?.()}
</label>
