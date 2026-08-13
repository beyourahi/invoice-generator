<!--
	In-page view switcher — visually + behaviorally identical to username-extractor's `SectionTabs`
	(the dropout-studio pricing-tab language): a dark rounded segmented control with an animated
	white sliding-pill indicator. Unlike SectionTabs (route links), these switch a LOCAL view, so
	they are real ARIA tabs (`role="tablist"`/`role="tab"`, `aria-selected`) driving a bound
	`value` — no navigation. Full width as equal segments on mobile; hugs content with wider buttons
	on sm+ (matching the SectionTabs width treatment: `flex-1` → `sm:flex-none sm:px-[30px]`).

	Pair each tab's panel with `role="tabpanel"` + `aria-labelledby="tab-<value>"` in the parent.
-->
<script lang="ts">
	import { cn } from "$lib/utils";

	type Tab = { value: string; label: string };

	let {
		value = $bindable(),
		tabs,
		ariaLabel = "View",
		class: className
	}: { value: string; tabs: Tab[]; ariaLabel?: string; class?: string } = $props();

	const activeIndex = $derived(
		Math.max(
			0,
			tabs.findIndex(t => t.value === value)
		)
	);

	let navEl = $state<HTMLDivElement>();
	let indicator = $state({ x: 0, y: 0, width: 0, height: 0, ready: false });
	let rafId = 0;

	const positionIndicator = () => {
		if (!navEl) return;
		const el = navEl.querySelectorAll<HTMLElement>("[data-view-tab]")[activeIndex];
		if (!el) return;
		const c = navEl.getBoundingClientRect();
		const b = el.getBoundingClientRect();
		const cs = getComputedStyle(navEl);
		const bl = parseFloat(cs.borderLeftWidth) || 0;
		const bt = parseFloat(cs.borderTopWidth) || 0;
		indicator = {
			x: b.left - c.left - bl + navEl.scrollLeft,
			y: b.top - c.top - bt + navEl.scrollTop,
			width: b.width,
			height: b.height,
			ready: true
		};
	};

	const schedulePosition = () => {
		cancelAnimationFrame(rafId);
		rafId = requestAnimationFrame(positionIndicator);
	};

	// Re-runs whenever the active tab changes, sliding the pill. Reading value + activeIndex
	// registers both as dependencies.
	$effect(() => {
		if (activeIndex >= 0 && value) schedulePosition();
	});

	// Mount-time setup + observers (effects run client-side only, mirroring onMount here).
	$effect(() => {
		positionIndicator();

		const onResize = () => schedulePosition();
		window.addEventListener("resize", onResize);
		window.addEventListener("load", schedulePosition);

		let ro: ResizeObserver | undefined;
		if (navEl && typeof ResizeObserver !== "undefined") {
			ro = new ResizeObserver(() => schedulePosition());
			ro.observe(navEl);
		}

		if (document.fonts?.ready) document.fonts.ready.then(positionIndicator);

		return () => {
			cancelAnimationFrame(rafId);
			window.removeEventListener("resize", onResize);
			window.removeEventListener("load", schedulePosition);
			ro?.disconnect();
		};
	});
</script>

<div
	bind:this={navEl}
	role="tablist"
	aria-label={ariaLabel}
	class={cn(
		"bg-ink-2 border-hair relative flex w-full max-w-full [scrollbar-width:none] flex-nowrap gap-[4px] overflow-x-auto rounded-full border p-[4px] [-ms-overflow-style:none] sm:w-fit [&::-webkit-scrollbar]:hidden",
		className
	)}
>
	<span
		aria-hidden="true"
		class="bg-signal pointer-events-none absolute top-0 left-0 z-0 rounded-full will-change-transform motion-reduce:transition-none"
		style:width="{indicator.width}px"
		style:height="{indicator.height}px"
		style:opacity={indicator.ready ? "1" : "0"}
		style:transform="translate3d({indicator.x}px,{indicator.y}px,0)"
		style:transition="transform 0.5s var(--ease), width 0.5s var(--ease), height 0.5s var(--ease)"
	></span>
	{#each tabs as tab (tab.value)}
		{@const active = tab.value === value}
		<button
			data-view-tab
			id="tab-{tab.value}"
			type="button"
			role="tab"
			aria-selected={active}
			onclick={() => (value = tab.value)}
			class="text-caption relative z-[1] flex min-h-[40px] flex-1 cursor-pointer items-center justify-center rounded-full px-[16px] py-[10px] whitespace-nowrap uppercase transition-colors duration-[350ms] ease-[var(--ease)] max-[720px]:min-h-[44px] max-[360px]:px-[12px] sm:flex-none sm:px-[30px] {active
				? 'text-background font-semibold'
				: 'text-ink-muted hover:text-foreground'}"
		>
			{tab.label}
		</button>
	{/each}
</div>
