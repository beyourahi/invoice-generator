<script lang="ts">
	import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
	import { ai } from "$lib/stores/ai.svelte";
	import { Sparkles, ScanLine } from "@lucide/svelte";
	import type { Snippet } from "svelte";

	let { preview, sidebar }: { preview: Snippet; sidebar: Snippet } = $props();
</script>

<Tabs value={ai.activeTab} onValueChange={v => ai.setActiveTab(v as "preview" | "ai")} class="w-full">
	<TabsList class="bg-card/40 border-border/60 mb-3 grid w-full grid-cols-2">
		<TabsTrigger value="preview" class="gap-1.5">
			<ScanLine class="size-3.5" aria-hidden="true" />
			Preview
		</TabsTrigger>
		<TabsTrigger value="ai" class="gap-1.5">
			<Sparkles class="size-3.5" aria-hidden="true" />
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
