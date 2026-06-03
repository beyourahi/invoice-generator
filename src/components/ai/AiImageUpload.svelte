<!--
	Vision attachment picker: re-encodes images to WebP via OffscreenCanvas (falling back to the
	raw data URL when canvas/bitmap is unavailable or for GIFs), enforces max 3 × 8 MB, and stores
	data URLs on the ai store. Hidden file input driven by the exported triggerUpload() (Composer's clip button).
-->
<script lang="ts">
	import { ai } from "$lib/stores/ai.svelte";
	import { Loader2, X } from "@lucide/svelte";

	const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/heic", "image/heif"];
	const MAX_SIZE = 8 * 1024 * 1024;

	let { onError }: { onError: (message: string) => void } = $props();

	let fileInput = $state<HTMLInputElement | null>(null);
	let processing = $state(0);

	const remaining = $derived(ai.maxPendingImages - ai.pendingImages.length);
	const isFull = $derived(remaining <= 0);

	export const triggerUpload = () => {
		if (processing === 0 && !isFull) fileInput?.click();
	};

	const reencodeToWebp = async (file: File): Promise<string> => {
		if (
			file.type === "image/gif" ||
			typeof createImageBitmap !== "function" ||
			typeof OffscreenCanvas !== "function"
		) {
			return toDataUrl(file);
		}
		try {
			const bitmap = await createImageBitmap(file);
			const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				bitmap.close?.();
				return toDataUrl(file);
			}
			ctx.drawImage(bitmap, 0, 0);
			const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.92 });
			bitmap.close?.();
			return toDataUrl(blob);
		} catch {
			return toDataUrl(file);
		}
	};

	const toDataUrl = (blob: Blob): Promise<string> =>
		new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(blob);
		});

	const addFile = async (file: File) => {
		if (!ACCEPTED.includes(file.type)) {
			onError("Please choose an image file (PNG, JPEG, WebP, or GIF).");
			return;
		}
		if (file.size > MAX_SIZE) {
			onError("That image is too large — keep it under 8 MB.");
			return;
		}
		processing += 1;
		try {
			const dataUrl = await reencodeToWebp(file);
			ai.addPendingImage(dataUrl);
		} catch {
			onError("Couldn't read that image. Please try a different file.");
		} finally {
			processing -= 1;
		}
	};

	const handleFileSelect = (event: Event) => {
		const input = event.target as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = "";
		// Subtract in-flight encodes (processing) so concurrent selections can't exceed the cap.
		const slots = ai.maxPendingImages - ai.pendingImages.length - processing;
		if (files.length > slots) {
			onError(`You can attach up to ${ai.maxPendingImages} images.`);
		}
		for (const file of files.slice(0, Math.max(slots, 0))) void addFile(file);
	};

	const placeholders = $derived(Array.from({ length: processing }, (_, i) => i));
</script>

<input
	bind:this={fileInput}
	type="file"
	accept={ACCEPTED.join(",")}
	multiple
	onchange={handleFileSelect}
	aria-label="Attach images"
	class="hidden"
/>

{#if ai.pendingImages.length > 0 || processing > 0}
	<div class="flex flex-wrap items-center gap-2 px-1 pt-1 pb-2.5">
		{#each ai.pendingImages as image, index (image)}
			<div
				class="border-chat-border-subtle relative size-12 shrink-0 overflow-hidden rounded-lg border"
			>
				<img src={image} alt="Attachment {index + 1}" class="size-full object-cover" />
				<button
					type="button"
					onclick={() => ai.removePendingImage(index)}
					aria-label="Remove attachment {index + 1}"
					class="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 backdrop-blur-[2px] transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
				>
					<X class="size-3.5 text-white" aria-hidden="true" />
				</button>
			</div>
		{/each}

		{#each placeholders as placeholder (placeholder)}
			<div
				class="border-chat-border-subtle flex size-12 shrink-0 items-center justify-center rounded-lg border border-dashed"
			>
				<Loader2 class="text-chat-text-muted size-4 animate-spin" aria-hidden="true" />
			</div>
		{/each}
	</div>
{/if}
