<!--
	Toggles for the five anomaly detectors. Each switch maps to a key on ai.anomalySettings
	(persisted to localStorage by the store); an enabled detector can force a Tier-B confirmation.
-->
<script lang="ts">
	import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "$lib/components/ui/dialog";
	import { Switch } from "$lib/components/ui/switch";
	import { Label } from "$lib/components/ui/label";
	import { ai } from "$lib/stores/ai.svelte";

	let { open, onOpenChange }: { open: boolean; onOpenChange: (next: boolean) => void } = $props();

	const toggles = [
		{
			key: "amountOutlier" as const,
			label: "Amount outlier check",
			hint: "Warn when an updated amount deviates far from a client's existing total."
		},
		{
			key: "volumeSurge" as const,
			label: "Volume surge",
			hint: "Warn when a single turn proposes more than 12 invoice entries."
		},
		{
			key: "missingPaymentMethods" as const,
			label: "Missing payment methods",
			hint: "Warn when a new client is created without any payment method."
		},
		{
			key: "stalePeriod" as const,
			label: "Stale period",
			hint: "Warn when adding invoices more than six months in the past."
		},
		{
			key: "currencyMismatch" as const,
			label: "Currency mismatch",
			hint: "Warn when a currency change leaves existing entries in the old currency."
		}
	];
</script>

<Dialog {open} {onOpenChange}>
	<DialogContent class="max-w-md">
		<DialogHeader>
			<DialogTitle class="text-balance">AI Safety</DialogTitle>
			<DialogDescription class="text-pretty">
				Toggle which anomaly checks force a confirmation dialog before auto-applying.
			</DialogDescription>
		</DialogHeader>
		<div class="space-y-3">
			{#each toggles as t (t.key)}
				<div class="flex items-start justify-between gap-3">
					<div class="flex-1">
						<Label for="ai-safety-{t.key}" class="text-chat-text-primary text-sm font-medium text-balance">
							{t.label}
						</Label>
						<p class="text-chat-text-muted text-xs text-pretty">{t.hint}</p>
					</div>
					<Switch
						id="ai-safety-{t.key}"
						checked={ai.anomalySettings[t.key]}
						onCheckedChange={(v: boolean) => ai.updateAnomalySettings({ [t.key]: v })}
					/>
				</div>
			{/each}
		</div>
	</DialogContent>
</Dialog>
