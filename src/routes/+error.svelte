<script lang="ts">
	import { page } from "$app/stores";
	import { resolve } from "$app/paths";
</script>

<div class="bg-background flex min-h-screen items-center justify-center px-4">
	<div class="space-y-4 text-center">
		<p class="text-foreground/10 text-6xl font-medium tabular-nums">{$page.status}</p>
		<p class="text-muted-foreground text-sm">{$page.error?.message ?? "something went wrong"}</p>
		<a
			href={resolve("/")}
			class="text-muted-foreground/60 hover:text-foreground mt-2 inline-flex items-center gap-1.5 text-xs transition-colors"
		>
			← back to invoice generator
		</a>
	</div>
</div>
