<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import Button from "$lib/components/ui/button.svelte";
	import { UserPlus } from "@lucide/svelte";
</script>

<Button
	variant="outline"
	class="text-muted-foreground hover:text-foreground w-full border-dashed"
	onclick={session.addClient}
>
	<UserPlus size={14} aria-hidden="true" />
	Add client
</Button>
