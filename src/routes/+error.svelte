<script lang="ts">
	import { page } from "$app/state";
	import { resolve } from "$app/paths";
	import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
	import { ArrowLeft, TriangleAlert } from "@lucide/svelte";
</script>

<div class="bg-background text-foreground flex min-h-dvh items-center justify-center px-4">
	<Card class="w-full max-w-md">
		<CardHeader class="items-center text-center">
			<div class="bg-destructive/10 text-destructive flex size-10 items-center justify-center rounded-lg">
				<TriangleAlert size={18} />
			</div>
			<CardTitle class="text-base">{page.status}</CardTitle>
		</CardHeader>
		<CardContent class="space-y-5 text-center">
			<p class="text-muted-foreground text-sm">{page.error?.message ?? "Something went wrong."}</p>
			<a
				href={resolve("/")}
				class="border-border hover:bg-accent hover:text-accent-foreground inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors"
			>
				<ArrowLeft size={13} />
				Back to generator
			</a>
		</CardContent>
	</Card>
</div>
