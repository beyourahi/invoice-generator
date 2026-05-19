<script lang="ts">
	import { ai } from "$lib/stores/ai.svelte";
	import { session } from "$lib/stores/session.svelte";
	import { Sparkles } from "@lucide/svelte";

	const hidden = $derived(session.generationState === "generating");
</script>

{#if !hidden}
	<button
		type="button"
		onclick={() => ai.setMobileOpen(true)}
		class="bg-foreground text-background hover:bg-foreground/90 active:bg-foreground/80 fixed right-4 bottom-4 z-40 inline-flex size-12 items-center justify-center rounded-full shadow-lg shadow-black/40 transition-colors lg:hidden"
		aria-label="Open AI Copilot"
	>
		<Sparkles class="size-5" aria-hidden="true" />
	</button>
{/if}
