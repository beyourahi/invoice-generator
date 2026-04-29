<script lang="ts">
	import { APP_CONFIG } from "$lib/config";
</script>

<footer class="flex items-center justify-center px-4 py-6 text-center text-xs text-zinc-500 sm:px-6 sm:py-8 sm:text-sm">
	<p>
		<a href={APP_CONFIG.author.url} target="_blank" rel="noopener noreferrer" class="group sleek">
			Designed by
			<span class="underline-offset-4 group-hover:text-white group-hover:underline">
				{APP_CONFIG.author.name}
			</span>
		</a>
	</p>
</footer>
