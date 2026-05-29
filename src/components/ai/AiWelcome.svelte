<script lang="ts">
	let {
		onSuggestionClick
	}: {
		onSuggestionClick: (text: string) => void;
	} = $props();

	const headline = "Type what you want. The invoices follow.";
	const subtext = "Describe an edit in plain words — the copilot updates the right clients and invoices for you.";

	const suggestions = [
		{ title: "show this month's revenue", desc: "see the running total", query: "Show this month's revenue" },
		{
			title: "top 5 clients by value",
			desc: "rank by invoice totals",
			query: "List my top 5 clients by invoice value"
		},
		{
			title: "follow-up overdue invoices",
			desc: "draft a polite nudge",
			query: "Draft a follow-up for overdue invoices"
		},
		{ title: "what can I do here?", desc: "see what's possible", query: "What can I do here?" }
	];
</script>

<div
	class="flex min-h-24 flex-1 flex-col items-center justify-center px-4 pb-4 md:min-h-0 md:justify-end md:px-6 md:pb-10"
>
	<div
		class="launcher-icon-row launcher-idle-row mb-5 md:mb-8"
		style="animation: chat-greeting-stagger 0.4s ease-out both; animation-delay: 0ms;"
		aria-hidden="true"
	>
		<div></div>
		<div></div>
		<div></div>
		<div></div>
	</div>
	<p
		class="text-chat-text-primary text-center text-lg font-medium text-balance md:text-xl"
		style="animation: chat-greeting-stagger 0.4s ease-out both; animation-delay: 100ms;"
	>
		{headline}
	</p>
	<p
		class="text-chat-text-secondary mt-2 text-center text-xs text-pretty md:mt-3 md:text-sm"
		style="animation: chat-greeting-stagger 0.4s ease-out both; animation-delay: 200ms;"
	>
		{subtext}
	</p>

	<div class="mt-5 flex w-full max-w-sm flex-col gap-2 md:mt-7 md:gap-2.5">
		{#each suggestions as suggestion, i (suggestion.query)}
			<button
				type="button"
				onclick={() => onSuggestionClick(suggestion.query)}
				class="border-chat-border-subtle bg-chat-surface hover:border-chat-border hover:bg-chat-surface-hover flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all duration-200 md:gap-3.5 md:px-4 md:py-3"
				style="animation: chat-greeting-stagger 0.4s ease-out both; animation-delay: {300 + i * 80}ms;"
			>
				<div
					class="bg-chat-accent-subtle flex h-8 w-8 shrink-0 items-center justify-center rounded-lg md:h-9 md:w-9"
				>
					<div
						class="launcher-icon-row launcher-idle-row"
						style="--launcher-box-row: 4px; --launcher-gap-row: 2px; --launcher-radius-row: 1px;"
						aria-hidden="true"
					>
						<div></div>
						<div></div>
						<div></div>
						<div></div>
					</div>
				</div>
				<div class="min-w-0">
					<p class="text-chat-text-primary text-sm font-medium">{suggestion.title}</p>
					<p class="text-chat-text-muted text-xs">{suggestion.desc}</p>
				</div>
			</button>
		{/each}
	</div>
</div>
