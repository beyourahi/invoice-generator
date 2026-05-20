<script lang="ts">
	import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
	import { ai } from "$lib/stores/ai.svelte";
	import { Sparkles, ScanLine } from "@lucide/svelte";
	import type { Snippet } from "svelte";

	let { preview, sidebar }: { preview: Snippet; sidebar: Snippet } = $props();

	const triggerClass =
		"gap-1.5 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:font-semibold data-[state=active]:shadow-sm data-[state=active]:shadow-black/20";
</script>

<Tabs value={ai.activeTab} onValueChange={v => ai.setActiveTab(v as "preview" | "ai")} class="w-full">
	<TabsList class="bg-card/60 border-border/60 mb-3 grid h-11! w-full grid-cols-2 gap-1 rounded-xl border p-1">
		<TabsTrigger value="preview" class={triggerClass}>
			<ScanLine class="size-4" aria-hidden="true" />
			Preview
		</TabsTrigger>
		<TabsTrigger value="ai" class={triggerClass}>
			<Sparkles class="size-4" aria-hidden="true" />
			AI
		</TabsTrigger>
	</TabsList>

	<TabsContent value="preview" class="m-0">
		{@render preview()}
	</TabsContent>
	<TabsContent value="ai" class="m-0">
		{@render sidebar()}
	</TabsContent>
</Tabs>
