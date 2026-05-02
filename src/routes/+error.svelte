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
				<TriangleAlert size={18} aria-hidden="true" />
			</div>
			<CardTitle class="text-base font-semibold">{page.status}</CardTitle>
		</CardHeader>
		<CardContent class="space-y-5 text-center">
			<p class="text-muted-foreground text-sm">
				{page.error?.message ?? "Something went wrong."}
			</p>
			<a
				href={resolve("/")}
				class="border-border hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-9 items-center justify-center gap-2 rounded-xl border bg-transparent px-4 text-sm font-medium transition-all duration-150 outline-none focus-visible:ring-3 active:translate-y-px active:scale-[0.97]"
			>
				<ArrowLeft size={14} aria-hidden="true" />
				Back to generator
			</a>
		</CardContent>
	</Card>
</div>
