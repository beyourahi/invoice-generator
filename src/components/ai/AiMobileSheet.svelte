<script lang="ts">
	import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "$lib/components/ui/sheet";
	import AiSidebar from "./AiSidebar.svelte";
	import { ai } from "$lib/stores/ai.svelte";
</script>

<Sheet open={ai.mobileOpen} onOpenChange={(v: boolean) => ai.setMobileOpen(v)}>
	<SheetContent
		side="bottom"
		class="bg-background flex h-[100dvh]! max-h-[100dvh]! w-full flex-col gap-0 border-0! p-0 sm:max-w-none"
	>
		<SheetHeader class="sr-only">
			<SheetTitle>AI Copilot</SheetTitle>
			<SheetDescription>Type what you want. The invoices follow.</SheetDescription>
		</SheetHeader>
		<div class="min-h-0 flex-1">
			<AiSidebar bare />
		</div>
	</SheetContent>
</Sheet>
