<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog";
	import { cn } from "$lib/utils";
	import { Check, ChevronDown } from "@lucide/svelte";

	export interface SelectOption {
		value: string;
		label: string;
		description?: string;
		badge?: string;
	}

	let {
		value = "",
		options = [],
		placeholder = "Select…",
		title = "Select",
		columns = 1,
		onSelect,
		disabled = false,
		class: className = ""
	}: {
		value: string;
		options: SelectOption[];
		placeholder?: string;
		title?: string;
		columns?: number;
		onSelect: (value: string) => void;
		disabled?: boolean;
		class?: string;
	} = $props();

	let open = $state(false);
	let listRef: HTMLDivElement | null = $state(null);

	const displayedLabel = $derived(options.find(o => o.value === value)?.label ?? "");

	const handleSelect = (optValue: string) => {
		onSelect(optValue);
		open = false;
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		if (!listRef) return;
		const items = Array.from(listRef.querySelectorAll<HTMLButtonElement>("[data-option]"));
		const idx = items.findIndex(el => el === document.activeElement);
		if (e.key === "ArrowDown") {
			e.preventDefault();
			items[(idx + 1) % items.length]?.focus();
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			items[(idx - 1 + items.length) % items.length]?.focus();
		}
	};

	const scrollIntoViewIfSelected = (node: HTMLElement, isSelected: boolean) => {
		if (isSelected) node.scrollIntoView({ block: "nearest", behavior: "instant" });
		return {
			update(s: boolean) {
				if (s) node.scrollIntoView({ block: "nearest", behavior: "instant" });
			}
		};
	};

	const contentClass = $derived(
		cn(
			"gap-0 p-0 data-open:slide-in-from-bottom-2 data-closed:slide-out-to-bottom-1",
			columns === 1 ? "sm:max-w-sm" : columns === 2 ? "sm:max-w-md" : "sm:max-w-lg"
		)
	);

	const listClass = $derived(
		cn(
			"max-h-72 overflow-y-auto p-1.5",
			columns === 2 && "sm:grid sm:grid-cols-2 sm:gap-x-1",
			columns === 3 && "grid grid-cols-2 gap-x-1 sm:grid-cols-3"
		)
	);
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger
		{disabled}
		class={cn(
			"border-input bg-background ring-offset-background focus-visible:ring-ring inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
			className
		)}
		aria-label={title}
	>
		<span class={cn("truncate text-left", !displayedLabel && "text-muted-foreground")}>
			{displayedLabel || placeholder}
		</span>
		<ChevronDown size={14} class="text-muted-foreground shrink-0" aria-hidden="true" />
	</Dialog.Trigger>

	<Dialog.Content class={contentClass} showCloseButton={false}>
		<Dialog.Header class="border-border border-b px-4 py-3.5">
			<Dialog.Title class="text-left text-sm font-semibold">{title}</Dialog.Title>
		</Dialog.Header>

		<div
			bind:this={listRef}
			role="listbox"
			aria-label={title}
			tabindex="-1"
			onkeydown={handleKeyDown}
			class={listClass}
		>
			{#each options as option (option.value)}
				{@const isSelected = option.value === value}
				<button
					type="button"
					role="option"
					aria-selected={isSelected}
					data-option
					data-selected={String(isSelected)}
					use:scrollIntoViewIfSelected={isSelected}
					onclick={() => handleSelect(option.value)}
					class={cn(
						"flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
						"hover:bg-accent hover:text-accent-foreground",
						"focus:bg-accent focus:text-accent-foreground focus:outline-none",
						isSelected && "bg-accent/40",
						columns > 1 && "justify-between"
					)}
				>
					<div class="min-w-0 flex-1">
						<span class="block text-sm leading-snug font-medium">{option.label}</span>
						{#if option.description}
							<span class="text-muted-foreground mt-0.5 block text-xs leading-snug">
								{option.description}
							</span>
						{/if}
					</div>
					{#if option.badge}
						<span class="text-muted-foreground/80 shrink-0 text-[11px] tracking-wider uppercase">
							{option.badge}
						</span>
					{:else if isSelected}
						<Check size={13} class="text-foreground shrink-0" aria-hidden="true" />
					{/if}
				</button>
			{/each}
		</div>
	</Dialog.Content>
</Dialog.Root>
