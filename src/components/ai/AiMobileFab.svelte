<script lang="ts">
	import { ai } from "$lib/stores/ai.svelte";
	import { session } from "$lib/stores/session.svelte";
	import AiLauncherIcon from "./AiLauncherIcon.svelte";

	const hidden = $derived(ai.mobileOpen || session.generationState === "generating");
</script>

{#if !hidden}
	<div class="fixed right-5 bottom-5 z-40 lg:hidden">
		<span class="chat-btn-ripple-ring" style="animation-delay: 0s" aria-hidden="true"></span>
		<span class="chat-btn-ripple-ring" style="animation-delay: 1.5s" aria-hidden="true"></span>
		<button
			type="button"
			onclick={() => ai.setMobileOpen(true)}
			class="group border-border-strong/60 bg-card hover:border-border-strong hover:bg-muted relative z-10 flex size-14 items-center justify-center rounded-full border border-solid shadow-2xl transition-all duration-300 ease-out active:scale-95"
			aria-label="Open AI Copilot"
		>
			<AiLauncherIcon variant="grid" class="size-6" />
		</button>
	</div>
{/if}
