<!--
	Chat input: auto-growing textarea (capped at MAX_HEIGHT), image attachments (picker + drag/drop),
	and send. Submit is allowed with text OR images alone; Enter sends, Shift+Enter inserts a newline.
	Exposes setValue() so AiWelcome suggestion cards can prefill the box. Drops are delegated to the
	upload child's addFile so all attachments share one validated/re-encode path.
-->
<script lang="ts">
	import { ai } from "$lib/stores/ai.svelte";
	import { cn } from "$lib/utils";
	import { ArrowUp, ImagePlus } from "@lucide/svelte";
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
	let imageUpload = $state<{ triggerUpload: () => void; addFile: (file: File) => Promise<void> } | null>(null);
	let dragging = $state(false);

	const MAX_HEIGHT = 200;

	const trimmed = $derived(value.trim());
	const charCount = $derived(trimmed.length);
	const hasImages = $derived(ai.pendingImages.length > 0);
	const attachFull = $derived(ai.pendingImages.length >= ai.maxPendingImages);
	const canSubmit = $derived((charCount > 0 || hasImages) && !disabled);

	// Reset-then-set height so the textarea shrinks as well as grows with content.
	$effect(() => {
		if (!textareaEl) return;
		void value;
		textareaEl.style.height = "auto";
		textareaEl.style.height = `${Math.min(textareaEl.scrollHeight, MAX_HEIGHT)}px`;
	});

	// Store bumps inputFocusNonce to programmatically refocus the composer (e.g. after a turn).
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

	const handleDrop = (event: DragEvent) => {
		event.preventDefault();
		dragging = false;
		const files = Array.from(event.dataTransfer?.files ?? []);
		for (const file of files) void imageUpload?.addFile(file);
	};

	const handleDragOver = (event: DragEvent) => {
		event.preventDefault();
		dragging = true;
	};

	const handleDragLeave = (event: DragEvent) => {
		const target = event.currentTarget as HTMLElement;
		if (!target.contains(event.relatedTarget as Node)) {
			dragging = false;
		}
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
		class={cn(
			"border-chat-border bg-chat-surface relative rounded-2xl border border-solid px-3 pt-2.5 pb-9 transition-colors duration-150 md:px-4 md:pt-3 md:pb-10",
			dragging && "border-chat-accent/30 bg-chat-accent/5"
		)}
		ondrop={handleDrop}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		role="presentation"
	>
		{#if dragging}
			<div
				class="border-chat-accent/30 bg-chat-accent/5 absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed"
			>
				<span class="text-chat-text-secondary text-sm">drop an image here</span>
			</div>
		{/if}

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
			style="max-height: {MAX_HEIGHT}px;"></textarea>

		<div class="absolute right-3 bottom-2.5 flex items-center gap-2">
			<button
				type="button"
				onclick={() => imageUpload?.triggerUpload()}
				disabled={disabled || attachFull}
				aria-label={attachFull ? `Attachment limit reached (${ai.maxPendingImages})` : "Attach an image"}
				title={attachFull ? `Up to ${ai.maxPendingImages} images` : "Attach an image"}
				class={cn(
					"ease-[var(--ease)] relative touch-manipulation rounded-full p-2 transition-all duration-200",
					hasImages
						? "bg-chat-accent-muted text-chat-text-primary"
						: "text-chat-text-muted hover:text-chat-text-secondary",
					(disabled || attachFull) && "cursor-not-allowed opacity-50"
				)}
			>
				<ImagePlus class="h-4 w-4" aria-hidden="true" />
			</button>
			<button
				type="button"
				onclick={handleSubmit}
				disabled={!canSubmit}
				aria-label={disabled ? "Generating response" : "Send message"}
				class={cn(
					"ease-[var(--ease)] touch-manipulation rounded-full p-2 transition-all duration-200",
					disabled
						? "bg-chat-accent-muted/40 text-chat-text-muted cursor-not-allowed"
						: canSubmit
							? "bg-signal text-background hover:bg-signal/90"
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
			class="text-chat-text-muted/60 absolute bottom-2.5 left-4 font-mono text-micro tracking-[0.1em] uppercase"
		>
			{#if disabled}
				generating…
			{:else}
				<span class="hidden md:inline">shift + enter for new line</span>
			{/if}
		</span>
	</div>
</div>
