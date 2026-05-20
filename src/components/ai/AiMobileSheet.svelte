<script lang="ts">
	import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "$lib/components/ui/sheet";
	import AiSidebar from "./AiSidebar.svelte";
	import { ai } from "$lib/stores/ai.svelte";
</script>

<Sheet open={ai.mobileOpen} onOpenChange={(v: boolean) => ai.setMobileOpen(v)}>
	<SheetContent side="bottom" class="flex h-[92vh] w-full flex-col gap-0 p-3 sm:max-w-none">
		<SheetHeader class="mb-3 gap-0.5 px-1 pt-0.5">
			<SheetTitle class="text-base text-balance">AI Copilot</SheetTitle>
			<SheetDescription class="text-muted-foreground text-xs text-pretty">
				Type what you want. The invoices follow.
			</SheetDescription>
		</SheetHeader>
		<div class="min-h-0 flex-1">
			<AiSidebar />
		</div>
	</SheetContent>
</Sheet>
