<!-- Active/inactive pill driven by semantic status color tokens; active dot pulses. -->
<script lang="ts">
	import { cn } from "$lib/utils";

	type Status = "active" | "inactive";
	type Size = "default" | "sm";

	let { status, size = "default", class: className = "" }: { status: Status; size?: Size; class?: string } = $props();

	const tone = $derived(
		status === "active"
			? "bg-status-active-bg text-status-active-foreground border-status-active-border"
			: "bg-status-inactive-bg text-status-inactive-foreground border-status-inactive-border"
	);

	const dotTone = $derived(status === "active" ? "bg-status-active status-dot-pulse" : "bg-status-inactive");

	const sizing = $derived(
		size === "sm"
			? "text-micro gap-1.5 px-2 py-0.5  font-medium tracking-[0.12em] uppercase"
			: "text-micro gap-1.5 px-2.5 py-1  font-medium tracking-[0.12em] uppercase"
	);

	const dotSize = $derived(size === "sm" ? "size-1.5" : "size-2");

	const label = $derived(status === "active" ? "Active" : "Inactive");
</script>

<span
	class={cn(
		"status-transition inline-flex shrink-0 items-center rounded-full border font-medium whitespace-nowrap",
		sizing,
		tone,
		className
	)}
>
	<span class={cn("status-transition shrink-0 rounded-full", dotSize, dotTone)} aria-hidden="true"></span>
	<span>{label}</span>
</span>
