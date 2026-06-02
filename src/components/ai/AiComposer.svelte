<script lang="ts">
	import { ai } from "$lib/stores/ai.svelte";
	import { cn } from "$lib/utils";
	import { ArrowUp, Paperclip } from "@lucide/svelte";
	import { tick } from "svelte";
	import AiImageUpload from "./AiImageUpload.svelte";

	let {
		onSend,
		disabled = false
	}: {
		onSend: (text: string) => void;
		disabled?: boolean;
	} = $props();

	let value = $state("");
	let textareaEl = $state<HTMLTextAreaElement | null>(null);
	let imageUpload = $state<{ triggerUpload: () => void } | null>(null);

	const MAX_HEIGHT = 200;

	const trimmed = $derived(value.trim());
	const charCount = $derived(trimmed.length);
	const hasImages = $derived(ai.pendingImages.length > 0);
	const attachFull = $derived(ai.pendingImages.length >= ai.maxPendingImages);
	const canSubmit = $derived((charCount > 0 || hasImages) && !disabled);

	$effect(() => {
		if (!textareaEl) return;
		void value;
		textareaEl.style.height = "auto";
		textareaEl.style.height = `${Math.min(textareaEl.scrollHeight, MAX_HEIGHT)}px`;
	});

	$effect(() => {
		if (ai.inputFocusNonce === 0) return;
		tick().then(() => textareaEl?.focus());
	});

	const handleSubmit = () => {
		if (!canSubmit) return;
		const text = trimmed.length > 0 ? trimmed : "Please review the attached image.";
		onSend(text);
		value = "";
		if (textareaEl) textareaEl.style.height = "auto";
	};

	const handleUploadError = (message: string) => {
		ai.setError(message);
	};

	export const setValue = (next: string) => {
		value = next;
		tick().then(() => {
			textareaEl?.focus();
			if (textareaEl) {
				textareaEl.selectionStart = textareaEl.selectionEnd = textareaEl.value.length;
			}
		});
	};

	const placeholder = $derived(disabled ? "generating response…" : "ask anything…");
</script>

<div class="px-3 pt-2 pb-3 md:px-4 md:pb-4">
	<div
		class="border-chat-border bg-chat-surface relative rounded-2xl border px-3 pt-2.5 pb-9 transition-colors duration-150 md:px-4 md:pt-3 md:pb-10"
	>
		<AiImageUpload bind:this={imageUpload} onError={handleUploadError} />

		<textarea
			bind:this={textareaEl}
			bind:value
			onkeydown={e => {
				if (e.key === "Enter" && !e.shiftKey) {
					e.preventDefault();
					handleSubmit();
				}
			}}
			{placeholder}
			name="ai-prompt"
			aria-label="Type a request"
			rows={2}
			{disabled}
			class={cn(
				"text-chat-text-primary chat-scrollbar min-h-[3.25rem] w-full resize-none bg-transparent text-base leading-relaxed transition-[height] duration-100 ease-out outline-none md:text-sm",
				disabled ? "placeholder:text-chat-text-secondary" : "placeholder:text-chat-text-muted"
			)}
			style="max-height: {MAX_HEIGHT}px;"
		></textarea>

		<button
			type="button"
			onclick={() => imageUpload?.triggerUpload()}
			disabled={disabled || attachFull}
			aria-label={attachFull
				? `Attachment limit reached (${ai.maxPendingImages})`
				: "Attach images"}
			title={attachFull ? `Up to ${ai.maxPendingImages} images` : "Attach images"}
			class={cn(
				"absolute bottom-2.5 left-3 rounded-lg p-2 transition-all duration-200 md:left-4",
				disabled || attachFull
					? "text-chat-text-muted/50 cursor-not-allowed"
					: "text-chat-text-muted hover:bg-chat-surface-hover hover:text-chat-text-primary active:scale-95"
			)}
		>
			<Paperclip class="h-4 w-4" aria-hidden="true" />
		</button>

		<div class="absolute right-3 bottom-2.5 flex items-center gap-2">
			<button
				type="button"
				onclick={handleSubmit}
				disabled={!canSubmit}
				aria-label={disabled ? "Generating response" : "Send message"}
				class={cn(
					"rounded-lg p-2 transition-all duration-200",
					disabled
						? "bg-chat-accent-muted/40 text-chat-text-muted cursor-not-allowed"
						: canSubmit
							? "bg-chat-accent-muted text-chat-text-primary hover:bg-chat-surface-hover active:scale-95"
							: "text-chat-text-muted cursor-not-allowed"
				)}
			>
				{#if disabled}
					<div class="flex h-4 w-4 items-center justify-center gap-[3px]" aria-hidden="true">
						<span
							class="chat-dot-pulse bg-chat-text-muted h-1 w-1 rounded-full"
							style="animation-delay: 0s;"
						></span>
						<span
							class="chat-dot-pulse bg-chat-text-muted h-1 w-1 rounded-full"
							style="animation-delay: 0.2s;"
						></span>
						<span
							class="chat-dot-pulse bg-chat-text-muted h-1 w-1 rounded-full"
							style="animation-delay: 0.4s;"
						></span>
					</div>
				{:else}
					<ArrowUp class="h-4 w-4" aria-hidden="true" />
				{/if}
			</button>
		</div>

		<span
			class="text-chat-text-muted/60 pointer-events-none absolute bottom-[1.15rem] left-12 text-[10px] md:left-14"
		>
			{#if disabled}
				generating…
			{:else}
				<span class="hidden md:inline">shift + enter for new line</span>
			{/if}
		</span>
	</div>
</div>
