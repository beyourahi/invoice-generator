<script lang="ts">
	import { APP_CONFIG } from "$lib/config";
</script>

<footer
	class="text-muted-foreground flex items-center justify-center px-4 py-6 text-center text-xs sm:px-6 sm:py-8 sm:text-sm"
>
	<p>
		<a
			href={APP_CONFIG.author.url}
			target="_blank"
			rel="noopener noreferrer"
			class="group hover:text-foreground transition-colors duration-200"
		>
			Designed by
			<span class="underline-offset-4 group-hover:underline">
				{APP_CONFIG.author.name}
			</span>
		</a>
		<span class="mx-2 opacity-50">·</span>
		<a
			href="https://dropoutstudio.co/tools"
			target="_blank"
			rel="noopener noreferrer"
			class="group hover:text-foreground transition-colors duration-200"
		>
			Check out
			<span class="underline-offset-4 group-hover:underline">
				other tools
			</span>
		</a>
	</p>
</footer>
