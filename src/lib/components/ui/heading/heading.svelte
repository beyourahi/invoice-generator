<script lang="ts">
	import { Heading, cn, helperBase } from "$lib/ds";
</script>

<div class="flex flex-col items-center gap-4 text-center sm:gap-6">
	<p class="text-4xl sm:text-5xl">🧾</p>

	<div class="flex flex-col items-center gap-1.5 sm:gap-2">
		<Heading as="h1" size="title-lg" weight={600} class="text-balance">Invoice Generator</Heading>
		<p class={cn(helperBase, "text-pretty")}>Batch PDFs, beautifully done.</p>
	</div>
</div>
