<script lang="ts">
	import type { Component, ComponentProps } from "svelte";
	import type { Icon as LucideIcon } from "@lucide/svelte";

	let { icon: Icon, label }: { icon: Component<ComponentProps<typeof LucideIcon>>; label: string } = $props();
</script>

<div class="flex items-center gap-2">
	<Icon size={14} class="text-muted-foreground" aria-hidden="true" />
	<p class="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">{label}</p>
</div>
