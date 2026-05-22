<script lang="ts">
	import type { PaymentMethodKind, SavedPaymentMethod } from "$lib/types";
	import { fixed } from "$lib/stores/fixed.svelte";
	import { session } from "$lib/stores/session.svelte";
	import { getMethodDef, isMethodComplete } from "$lib/payments/registry";
	import { cn } from "$lib/utils";
	import Button from "$lib/components/ui/button.svelte";
	import Input from "$lib/components/ui/input.svelte";
	import Textarea from "$lib/components/ui/textarea.svelte";
	import * as Field from "$lib/components/ui/field";
	import OverflowActions from "$src/components/OverflowActions.svelte";
	import { ArrowDown, ArrowUp, ChevronDown, Trash2 } from "@lucide/svelte";
	import { slide } from "svelte/transition";
	import { motionDuration } from "$lib/motion";

	type FieldElement = HTMLInputElement | HTMLTextAreaElement;

	let {
		method,
		index,
		total,
		expanded = false,
		onToggle,
		onRemove,
		onMove
	}: {
		method: SavedPaymentMethod;
		index: number;
		total: number;
		expanded?: boolean;
		onToggle?: (next: boolean) => void;
		onRemove?: () => void;
		onMove?: (direction: -1 | 1) => void;
	} = $props();

	const removeMethod = () => {
		if (onRemove) {
			onRemove();
			return;
		}
		fixed.removePaymentMethod(method.id);
		session.purgePaymentMethodFromClients(method.id);
	};

	const moveMethod = (direction: -1 | 1) => {
		if (onMove) {
			onMove(direction);
			return;
		}
		fixed.movePaymentMethod(method.id, direction);
	};

	const def = $derived(getMethodDef(method.kind));
	const complete = $derived(isMethodComplete(method));
	const summary = $derived.by(() => {
		const d = getMethodDef(method.kind);
		const primary = d.fields.map(f => method.values[f.key]?.trim()).find(v => v && v.length > 0);
		return primary ?? d.description;
	});

	const valueFrom = (e: Event) => (e.currentTarget as FieldElement).value;
	const inputType = (kind: PaymentMethodKind, type?: string): string => {
		if (kind === "bkash" || kind === "nagad" || kind === "rocket") return "tel";
		return type ?? "text";
	};

	const remove = (event: MouseEvent) => {
		event.stopPropagation();
		removeMethod();
	};

	const move = (direction: -1 | 1, event: MouseEvent) => {
		event.stopPropagation();
		moveMethod(direction);
	};

	const overflowActions = $derived([
		{
			label: "Move up",
			icon: ArrowUp,
			disabled: index === 0,
			onSelect: () => moveMethod(-1)
		},
		{
			label: "Move down",
			icon: ArrowDown,
			disabled: index === total - 1,
			onSelect: () => moveMethod(1)
		},
		{
			label: "Remove payment method",
			icon: Trash2,
			variant: "destructive" as const,
			onSelect: removeMethod
		}
	]);
</script>

<div class="border-border bg-card rounded-lg border">
	<button
		type="button"
		onclick={() => onToggle?.(!expanded)}
		class="pointer-fine:hover:bg-accent/40 flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
		aria-expanded={expanded}
		aria-controls="method-panel-{method.id}"
	>
		<span
			class={cn(
				"rounded-md px-1.5 py-0.5 font-mono text-[11px] tracking-wider whitespace-nowrap uppercase",
				complete ? "bg-brand/15 text-success" : "bg-muted text-muted-foreground"
			)}
		>
			{def.shortName}
		</span>
		<div class="min-w-0 flex-1">
			<p class="truncate text-sm font-medium">{method.label || def.name}</p>
			<p class="text-muted-foreground truncate text-xs">{summary}</p>
		</div>
		<div class="flex shrink-0 items-center gap-0.5">
			<div class="hidden items-center gap-0.5 sm:flex">
				<Button
					variant="ghost"
					size="icon-sm"
					class="text-muted-foreground pointer-fine:hover:text-foreground h-8 w-8"
					onclick={(e: MouseEvent) => move(-1, e)}
					disabled={index === 0}
					aria-label="Move up"
				>
					<ArrowUp size={12} aria-hidden="true" />
				</Button>
				<Button
					variant="ghost"
					size="icon-sm"
					class="text-muted-foreground pointer-fine:hover:text-foreground h-8 w-8"
					onclick={(e: MouseEvent) => move(1, e)}
					disabled={index === total - 1}
					aria-label="Move down"
				>
					<ArrowDown size={12} aria-hidden="true" />
				</Button>
				<Button
					variant="ghost"
					size="icon-sm"
					class="text-muted-foreground pointer-fine:hover:bg-destructive/10 pointer-fine:hover:text-destructive h-8 w-8"
					onclick={remove}
					aria-label="Remove payment method"
				>
					<Trash2 size={12} aria-hidden="true" />
				</Button>
			</div>
			<div class="sm:hidden">
				<OverflowActions actions={overflowActions} label={method.label || def.name} />
			</div>
			<ChevronDown
				size={14}
				class={cn("text-muted-foreground ml-1 transition-transform duration-200", expanded && "rotate-180")}
				aria-hidden="true"
			/>
		</div>
	</button>

	{#if expanded}
		<div
			id="method-panel-{method.id}"
			class="border-border space-y-3 border-t px-3 pt-3 pb-4"
			transition:slide={{ duration: motionDuration("base") }}
		>
			<Field.Field class="gap-1.5">
				<Field.FieldLabel for="label-{method.id}">Display label</Field.FieldLabel>
				<Input
					id="label-{method.id}"
					placeholder={def.name}
					value={method.label}
					oninput={(e: Event) => fixed.updatePaymentMethodLabel(method.id, valueFrom(e))}
				/>
				<Field.FieldDescription>Shown above this method on the invoice.</Field.FieldDescription>
			</Field.Field>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{#each def.fields as field (field.key)}
					<Field.Field class={cn("gap-1.5", field.type === "textarea" && "sm:col-span-2")}>
						<Field.FieldLabel for="{method.id}-{field.key}">
							{field.label}
							{#if field.optional}
								<span class="text-muted-foreground ml-1 text-[11px]">optional</span>
							{/if}
						</Field.FieldLabel>
						{#if field.type === "textarea"}
							<Textarea
								id="{method.id}-{field.key}"
								placeholder={field.placeholder}
								value={method.values[field.key] ?? ""}
								oninput={(e: Event) =>
									fixed.updatePaymentMethodValue(method.id, field.key, valueFrom(e))}
								rows={3}
							/>
						{:else}
							<Input
								id="{method.id}-{field.key}"
								type={inputType(method.kind, field.type)}
								placeholder={field.placeholder}
								value={method.values[field.key] ?? ""}
								oninput={(e: Event) =>
									fixed.updatePaymentMethodValue(method.id, field.key, valueFrom(e))}
								class={field.monospace ? "tabular-nums" : ""}
							/>
						{/if}
					</Field.Field>
				{/each}
			</div>
		</div>
	{/if}
</div>
