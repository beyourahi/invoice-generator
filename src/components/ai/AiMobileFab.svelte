<script lang="ts">
	import { ai } from "$lib/stores/ai.svelte";
	import { session } from "$lib/stores/session.svelte";
	import { Sparkles } from "@lucide/svelte";

	const hidden = $derived(session.generationState === "generating");
</script>

{#if !hidden}
	<div class="fixed right-4 bottom-4 z-40 lg:hidden">
		<span class="ai-ring bg-foreground/25 pointer-events-none absolute inset-0 rounded-full" aria-hidden="true"
		></span>
		<button
			type="button"
			onclick={() => ai.setMobileOpen(true)}
			class="bg-foreground text-background pointer-fine:hover:bg-foreground/90 ring-background/10 relative inline-flex size-12 items-center justify-center rounded-full shadow-lg ring-1 shadow-black/40 transition-transform active:scale-95"
			aria-label="Open AI Copilot"
		>
			<Sparkles class="size-5" aria-hidden="true" />
		</button>
	</div>
{/if}
