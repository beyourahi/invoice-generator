<script lang="ts">
	import type { Component, ComponentProps } from "svelte";
	import * as Dialog from "$lib/components/ui/dialog";
	import { cn } from "$lib/utils";
	import { MoreVertical, type Icon as LucideIcon } from "@lucide/svelte";

	type IconComponent = Component<ComponentProps<typeof LucideIcon>>;

	export interface OverflowAction {
		label: string;
		icon?: IconComponent;
		onSelect: () => void;
		variant?: "default" | "destructive";
		disabled?: boolean;
	}

	let {
		actions,
		label = "More actions",
		class: className = ""
	}: {
		actions: OverflowAction[];
		label?: string;
		class?: string;
	} = $props();

	let open = $state(false);

	const handleAction = (action: OverflowAction, e: MouseEvent) => {
		e.stopPropagation();
		if (action.disabled) return;
		action.onSelect();
		open = false;
	};
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger
		aria-label={label}
		onclick={(e: MouseEvent) => e.stopPropagation()}
		class={cn(
			"text-muted-foreground pointer-fine:hover:bg-accent pointer-fine:hover:text-foreground focus-visible:ring-ring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50",
			className
		)}
	>
		<MoreVertical size={16} aria-hidden="true" />
	</Dialog.Trigger>

	<Dialog.Content
		class="data-open:slide-in-from-bottom-2 data-closed:slide-out-to-bottom-1 gap-0 p-0 sm:max-w-sm"
		showCloseButton={false}
	>
		<Dialog.Header class="border-border border-b px-4 py-3">
			<Dialog.Title class="text-left text-sm font-semibold text-balance">{label}</Dialog.Title>
		</Dialog.Header>

		<div class="flex flex-col p-2">
			{#each actions as action, idx (idx)}
				{@const Icon = action.icon}
				<button
					type="button"
					disabled={action.disabled}
					onclick={e => handleAction(action, e)}
					class={cn(
						"flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left transition-colors",
						"pointer-fine:hover:bg-accent pointer-fine:hover:text-accent-foreground",
						"focus:bg-accent focus:text-accent-foreground focus:outline-none",
						"disabled:cursor-not-allowed disabled:opacity-40",
						action.variant === "destructive" &&
							"text-destructive pointer-fine:hover:bg-destructive/10 pointer-fine:hover:text-destructive"
					)}
				>
					{#if Icon}
						<Icon size={16} aria-hidden="true" />
					{/if}
					<span class="text-sm font-medium whitespace-nowrap">{action.label}</span>
				</button>
			{/each}
		</div>
	</Dialog.Content>
</Dialog.Root>
