<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLButtonAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	type Variant = "default" | "outline" | "ghost" | "destructive" | "secondary";
	type Size = "sm" | "default" | "lg" | "icon" | "icon-sm";

	let {
		class: className = "",
		variant = "default",
		size = "default",
		children,
		...props
	}: {
		class?: string;
		variant?: Variant;
		size?: Size;
		children?: Snippet;
	} & HTMLButtonAttributes = $props();

	const variants: Record<Variant, string> = {
		default:
			"bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
		outline:
			"border border-border bg-transparent hover:bg-accent hover:text-accent-foreground",
		ghost: "bg-transparent hover:bg-accent hover:text-accent-foreground",
		secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
		destructive:
			"bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20"
	};

	const sizes: Record<Size, string> = {
		sm: "h-7 rounded-lg px-3 text-xs gap-1.5",
		default: "h-9 rounded-xl px-4 text-sm gap-2",
		lg: "h-11 rounded-xl px-6 text-sm gap-2",
		icon: "h-9 w-9 rounded-xl",
		"icon-sm": "h-7 w-7 rounded-lg"
	};
</script>

<button
	class={cn(
		"inline-flex items-center justify-center font-medium whitespace-nowrap",
		"transition-all duration-150 select-none",
		"focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
		"disabled:pointer-events-none disabled:opacity-40",
		"active:scale-[0.97] active:translate-y-px",
		variants[variant],
		sizes[size],
		className
	)}
	{...props}
>
	{@render children?.()}
</button>
