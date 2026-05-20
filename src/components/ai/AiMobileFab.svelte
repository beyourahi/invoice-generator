<script lang="ts">
	import { ai } from "$lib/stores/ai.svelte";
	import { session } from "$lib/stores/session.svelte";

	const hidden = $derived(session.generationState === "generating");
</script>

{#if !hidden}
	<div class="fixed right-5 bottom-5 z-40 lg:hidden">
		<span class="chat-btn-ripple-ring" style="animation-delay: 0s" aria-hidden="true"></span>
		<span class="chat-btn-ripple-ring" style="animation-delay: 1.5s" aria-hidden="true"></span>
		<button
			type="button"
			onclick={() => ai.setMobileOpen(true)}
			class="group border-border bg-card pointer-fine:hover:border-muted-foreground pointer-fine:hover:bg-muted relative z-10 flex size-14 items-center justify-center rounded-full border shadow-2xl transition-all duration-300 ease-out active:scale-95"
			aria-label="Open AI Copilot"
		>
			<div class="launcher-icon launcher-idle h-6 w-6 shrink-0" aria-hidden="true">
				<div class="launcher-box-a"></div>
				<div class="launcher-box-b"></div>
				<div class="launcher-box-c"></div>
				<div class="launcher-box-d"></div>
			</div>
		</button>
	</div>
{/if}
