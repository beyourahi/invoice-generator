<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import { Plus } from "@lucide/svelte";
</script>

<button
	onclick={session.addClient}
	class="w-full h-11 rounded-2xl border border-dashed border-border/50
           flex items-center justify-center gap-2
           text-sm text-muted-foreground/60
           hover:border-border hover:text-muted-foreground hover:bg-accent/20
           active:scale-[0.99] transition-all duration-150"
>
	<Plus size={14} />
	add client
</button>
