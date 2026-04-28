<script lang="ts">
	import { page } from "$app/stores";
	import { resolve } from "$app/paths";
</script>

<div class="min-h-screen bg-background flex items-center justify-center px-4">
	<div class="text-center space-y-4">
		<p class="text-6xl font-medium tabular-nums text-foreground/10">{$page.status}</p>
		<p class="text-sm text-muted-foreground">{$page.error?.message ?? "something went wrong"}</p>
		<a
			href={resolve("/")}
			class="inline-flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors mt-2"
		>
			← back to invoice generator
		</a>
	</div>
</div>
