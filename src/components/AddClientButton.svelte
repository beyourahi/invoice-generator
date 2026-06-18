<!-- Adds a new client to the session. Renders below the ClientCard list as a DS hairline CTA. -->
<script lang="ts">
	import { session } from "$lib/stores/session.svelte";
	import { Cta } from "@dropout/ds";
	import { UserPlus } from "@lucide/svelte";

	// onAdd overrides the default session.addClient(); omit it to use the store default.
	let { onAdd }: { onAdd?: () => void } = $props();

	const handleClick = () => {
		if (onAdd) onAdd();
		else void session.addClient();
	};
</script>

<Cta variant="secondary" arrow={false} class="w-full justify-center" onclick={handleClick}>
	<span class="inline-flex items-center gap-2">
		<UserPlus size={15} aria-hidden="true" />
		Add client
	</span>
</Cta>
