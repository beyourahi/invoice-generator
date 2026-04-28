<script lang="ts">
	import { onMount } from "svelte";
	import { gsap } from "gsap";
	import { LayoutList, Braces } from "@lucide/svelte";

	let { jsonMode = $bindable(false) }: { jsonMode?: boolean } = $props();

	const WORDMARK = "invoice generator".split("");
	let charEls = $state<(HTMLSpanElement | undefined)[]>([]);
	let headerEl: HTMLElement;

	onMount(() => {
		const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
		tl.from(headerEl, { opacity: 0, duration: 0.3 }).from(
			charEls,
			{ opacity: 0, y: 12, duration: 0.5, stagger: 0.025 },
			"-=0.1"
		);
	});
</script>

<header
	bind:this={headerEl}
	class="border-border/40 bg-background/95 fixed top-0 z-50 h-14 w-full border-b backdrop-blur-sm"
>
	<div class="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
		<h1 class="text-sm leading-none font-medium tracking-tight">
			{#each WORDMARK as char, i (i)}
				<span bind:this={charEls[i]} class={char === " " ? "inline-block w-[0.3em]" : "inline-block"}
					>{char}</span
				>
			{/each}
		</h1>

		<div class="border-border/60 bg-card flex gap-0.5 rounded-lg border p-0.5">
			<button
				onclick={() => (jsonMode = false)}
				class="flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-all duration-150 {!jsonMode
					? 'bg-accent text-foreground'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				<LayoutList size={12} />
				Form
			</button>
			<button
				onclick={() => (jsonMode = true)}
				class="flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-all duration-150 {jsonMode
					? 'bg-accent text-foreground'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				<Braces size={12} />
				JSON
			</button>
		</div>
	</div>
</header>
