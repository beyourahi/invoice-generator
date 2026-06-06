<script lang="ts">
	import { APP_CONFIG } from "$lib/config";
</script>

<footer
	class="text-muted-foreground flex flex-col items-center justify-center gap-2 px-4 py-6 text-center text-xs sm:px-6 sm:py-8 sm:text-sm"
>
	<p class="text-pretty">
		<a href="/changelog" class="group whitespace-nowrap">
			<span
				class="pointer-fine:group-hover:text-foreground underline-offset-4 pointer-fine:group-hover:underline"
			>
				Changelog
			</span>
		</a>
		<span class="mx-2 opacity-50">·</span>
		<a
			href="https://dropoutstudio.co/tools"
			target="_blank"
			rel="noopener noreferrer"
			class="group whitespace-nowrap"
		>
			Check out
			<span
				class="pointer-fine:group-hover:text-foreground underline-offset-4 pointer-fine:group-hover:underline"
			>
				other tools
			</span>
		</a>
	</p>
	<p class="text-pretty">
		<a href={APP_CONFIG.author.url} target="_blank" rel="noopener noreferrer" class="group whitespace-nowrap">
			Designed by
			<span
				class="pointer-fine:group-hover:text-foreground underline-offset-4 pointer-fine:group-hover:underline"
			>
				{APP_CONFIG.author.name}
			</span>
		</a>
	</p>
</footer>
