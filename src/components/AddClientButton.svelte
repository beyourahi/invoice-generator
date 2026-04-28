<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import Button from "$lib/components/ui/button.svelte";
	import { Plus } from "@lucide/svelte";
</script>

<Button variant="outline" class="w-full border-dashed" onclick={session.addClient}>
	<Plus size={14} />
	Add Client
</Button>
