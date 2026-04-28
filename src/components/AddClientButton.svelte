<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import { Plus } from "@lucide/svelte";
</script>

<button
	onclick={session.addClient}
	class="border-border/50 text-muted-foreground/60 hover:border-border hover:text-muted-foreground hover:bg-accent/20 flex
           h-11 w-full items-center justify-center
           gap-2 rounded-2xl
           border border-dashed text-sm
           transition-all duration-150 active:scale-[0.99]"
>
	<Plus size={14} />
	add client
</button>
