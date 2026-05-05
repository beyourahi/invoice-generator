<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import Button from "$lib/components/ui/button.svelte";
	import { UserPlus } from "@lucide/svelte";
</script>

<Button size="lg" class="w-full" onclick={session.addClient}>
	<UserPlus size={16} aria-hidden="true" />
	Add client
</Button>
