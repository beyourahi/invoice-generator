<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import Button from "$lib/components/ui/button.svelte";
	import { UserPlus } from "@lucide/svelte";

	let { onAdd }: { onAdd?: () => void } = $props();

	const handleClick = () => {
		if (onAdd) onAdd();
		else void session.addClient();
	};
</script>

<Button size="lg" class="w-full whitespace-nowrap" onclick={handleClick}>
	<UserPlus size={16} aria-hidden="true" />
	Add client
</Button>
