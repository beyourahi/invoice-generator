<script lang="ts">
	import { APP_CONFIG } from "$lib/config";
</script>

<footer
	class="text-muted-foreground flex items-center justify-center px-4 py-6 text-center text-xs sm:px-6 sm:py-8 sm:text-sm"
>
	<p>
		<a href={APP_CONFIG.author.url} target="_blank" rel="noopener noreferrer" class="group sleek">
			Designed by
			<span class="group-hover:text-foreground underline-offset-4 group-hover:underline">
				{APP_CONFIG.author.name}
			</span>
		</a>
	</p>
</footer>
