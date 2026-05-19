<script lang="ts">
	import {
		Sheet,
		SheetContent,
		SheetDescription,
		SheetHeader,
		SheetTitle
	} from "$lib/components/ui/sheet";
	import AiSidebar from "./AiSidebar.svelte";
	import { ai } from "$lib/stores/ai.svelte";
</script>

<Sheet open={ai.mobileOpen} onOpenChange={(v: boolean) => ai.setMobileOpen(v)}>
	<SheetContent side="bottom" class="h-[92vh] w-full p-3 sm:max-w-none">
		<SheetHeader class="px-1 pt-1">
			<SheetTitle>AI Copilot</SheetTitle>
			<SheetDescription class="text-muted-foreground text-xs">
				Type what you want. The invoices follow.
			</SheetDescription>
		</SheetHeader>
		<div class="mt-3 h-[calc(92vh-5rem)]">
			<AiSidebar />
		</div>
	</SheetContent>
</Sheet>
