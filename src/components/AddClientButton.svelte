<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import { Plus } from "@lucide/svelte";
</script>

<button
	onclick={session.addClient}
	class="border-border/40 text-muted-foreground/50 hover:border-brand/50 hover:text-brand flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-dashed text-xs transition-all duration-150 active:scale-[0.99]"
>
	<Plus size={13} />
	add client
</button>
