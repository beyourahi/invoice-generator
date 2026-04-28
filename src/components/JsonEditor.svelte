<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import type { Client } from "$lib/types";

	let { onClose }: { onClose: () => void } = $props();

	let parseError = $state<string | null>(null);
	let debounceTimer: ReturnType<typeof setTimeout>;
	let text = $state(JSON.stringify({ clients: session.clients }, null, 2));

	const validate = (value: string): { clients: Client[] } | null => {
		try {
			const parsed = JSON.parse(value);
			if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.clients)) return null;
			return parsed as { clients: Client[] };
		} catch {
			return null;
		}
	};

	const handleInput = () => {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			parseError = validate(text) ? null : "invalid JSON — expected { clients: [...] }";
		}, 400);
	};

	const apply = () => {
		const result = validate(text);
		if (!result) {
			parseError = "invalid JSON — fix errors before applying";
			return;
		}
		let applied = 0;
		for (const clientData of result.clients) {
			if (session.clients.some(c => c.id === clientData.id)) {
				session.updateClient(clientData.id, () => clientData);
				applied++;
			}
		}
		if (applied === 0) {
			parseError = "no matching client IDs found — JSON must contain existing client IDs";
			return;
		}
		parseError = null;
		onClose();
	};

	const reset = () => {
		text = JSON.stringify({ clients: session.clients }, null, 2);
		parseError = null;
	};
</script>

<div class="flex h-full min-h-[400px] flex-col gap-3">
	<div class="flex items-center justify-between">
		<span class="text-muted-foreground text-[11px] font-medium tracking-widest uppercase"> Client Data </span>
		<p class="text-muted-foreground/50 text-[11px]">edit existing clients by ID · add/remove via form</p>
	</div>

	<textarea
		bind:value={text}
		oninput={handleInput}
		spellcheck={false}
		class="bg-background text-foreground min-h-[360px] flex-1 resize-none rounded-xl border p-4 font-mono text-xs leading-relaxed transition-colors duration-150 focus-visible:outline-none {parseError
			? 'border-destructive'
			: 'border-border/60 focus-visible:border-brand/60'}"
	></textarea>

	{#if parseError}
		<p class="text-destructive text-xs">{parseError}</p>
	{/if}

	<div class="flex items-center gap-2">
		<button
			onclick={reset}
			class="border-border/60 text-muted-foreground hover:border-border hover:text-foreground h-9 flex-1 rounded-xl border text-xs transition-all duration-150"
		>
			Reset
		</button>
		<button
			onclick={apply}
			disabled={!!parseError}
			class="bg-brand text-brand-foreground hover:bg-brand/90 h-9 flex-1 rounded-xl text-xs font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-40"
		>
			Apply
		</button>
	</div>
</div>
