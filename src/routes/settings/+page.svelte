<!--
	Settings — the BYO Cloudflare connection for the AI Copilot. Signed-in only (the
	loader redirects guests to /login). Built entirely from the vendored Dropout DS:
	Eyebrow/Heading/Input/Cta + inputBase/labelBase, dark-canonical, editorial.
	Connecting an account is REQUIRED to use the Copilot; inference is billed to the user.
-->
<script lang="ts">
	import { untrack, onMount } from "svelte";
	import { enhance } from "$app/forms";
	import { browser } from "$app/environment";
	import { invalidateAll } from "$app/navigation";
	import { authClient } from "$lib/auth-client";
	import { ArrowLeft, RefreshCw, Fingerprint, Trash2, Cloud } from "@lucide/svelte";
	import {
		Eyebrow,
		Heading,
		Input,
		Cta,
		cn,
		inputBase,
		labelBase,
		bodyBase,
		helperBase,
		metaBase,
		SettingsSection,
		SettingsRow,
		SettingsActions
	} from "$lib/ds";
	import * as Select from "$lib/components/ui/select";
	import type { PageData, ActionData } from "./$types";

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const DEFAULT_MODEL = "@cf/moonshotai/kimi-k2.6";

	const connected = $derived(data.connected);
	const maskedToken = $derived(data.maskedToken ?? "");

	// Editable fields are seeded ONCE from server data; `enhance({ reset: false })`
	// preserves them across submits, and a fresh load resets them via component re-key.
	let token = $state("");
	let accountId = $state(untrack(() => data.accountId ?? ""));
	let model = $state(untrack(() => data.model ?? DEFAULT_MODEL));
	let saving = $state(false);

	// Picker options from the account's cached chat models. Always surfaces the
	// recommended default first and the currently-selected id, even if the live list omits it.
	const modelOptions = $derived.by(() => {
		const list = data.models ?? [];
		const ids = new Set(list.map(m => m.id));
		const opts = list.map(m => ({
			id: m.id,
			label:
				m.id === DEFAULT_MODEL
					? `${m.label} · recommended`
					: `${m.label} · experimental${m.deprecated ? " (deprecated)" : ""}`
		}));
		if (!ids.has(DEFAULT_MODEL)) {
			opts.unshift({ id: DEFAULT_MODEL, label: "moonshotai/kimi-k2.6 · recommended" });
		}
		if (model && model !== DEFAULT_MODEL && !ids.has(model)) {
			opts.push({ id: model, label: `${model.replace(/^@cf\//, "")} · experimental` });
		}
		return opts;
	});

	const selectedModelLabel = $derived(modelOptions.find(o => o.id === model)?.label ?? "Select a model");

	let refreshing = $state(false);
	const refreshModels = async () => {
		refreshing = true;
		try {
			await fetch("/api/cf/models?refresh=1");
			await invalidateAll();
		} finally {
			refreshing = false;
		}
	};

	// ── Face ID / Touch ID (WebAuthn platform biometrics) ──────────────────────────────────
	type PasskeyRow = { id: string; name?: string | null; createdAt?: string | Date | null };
	let passkeys = $state<PasskeyRow[]>([]);
	let passkeysLoading = $state(true);
	let passkeyBusy = $state(false);
	let webauthnAvailable = $state(false);
	let passkeyError = $state<string | null>(null);
	let passkeyMessage = $state<string | null>(null);

	// Friendly default name from the UA — stored as the passkey label.
	const deviceLabel = () => {
		const ua = browser ? navigator.userAgent : "";
		if (/iPhone|iPad|iPod/.test(ua)) return "iPhone (Face ID / Touch ID)";
		if (/Macintosh/.test(ua)) return "Mac (Touch ID)";
		if (/Android/.test(ua)) return "Android (fingerprint / face)";
		if (/Windows/.test(ua)) return "Windows Hello";
		return "This device";
	};

	const formatDate = (d: string | Date) => {
		const date = typeof d === "string" ? new Date(d) : d;
		return Number.isNaN(date.getTime())
			? ""
			: date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
	};

	const loadPasskeys = async () => {
		passkeysLoading = true;
		try {
			const res = await authClient.passkey.listUserPasskeys();
			passkeys = (res?.data ?? []) as PasskeyRow[];
		} catch {
			passkeys = [];
		} finally {
			passkeysLoading = false;
		}
	};

	onMount(() => {
		webauthnAvailable = typeof window !== "undefined" && !!window.PublicKeyCredential;
		if (webauthnAvailable) loadPasskeys();
		else passkeysLoading = false;
	});

	// Always registers a platform biometric (Face ID / Touch ID; Windows Hello / Android
	// fingerprint) — `authenticatorAttachment: "platform"` excludes roaming security keys.
	const addPasskey = async () => {
		passkeyBusy = true;
		passkeyError = null;
		passkeyMessage = null;
		try {
			const res = await authClient.passkey.addPasskey({
				name: deviceLabel(),
				authenticatorAttachment: "platform"
			});
			if (res?.error) passkeyError = res.error.message || "Couldn't add Face ID / Touch ID.";
			else {
				passkeyMessage = "Face ID / Touch ID added.";
				await loadPasskeys();
			}
		} catch {
			passkeyError = "Setup was cancelled.";
		} finally {
			passkeyBusy = false;
		}
	};

	const removePasskey = async (id: string) => {
		if (!confirm("Remove this Face ID / Touch ID? You won't be able to sign in with it anymore.")) return;
		passkeyBusy = true;
		passkeyError = null;
		passkeyMessage = null;
		try {
			const res = await authClient.passkey.deletePasskey({ id });
			if (res?.error) passkeyError = res.error.message || "Couldn't remove it.";
			else {
				passkeyMessage = "Face ID / Touch ID removed.";
				await loadPasskeys();
			}
		} catch {
			passkeyError = "Couldn't remove it.";
		} finally {
			passkeyBusy = false;
		}
	};
</script>

<svelte:head>
	<title>Settings · Invoice Generator</title>
</svelte:head>

<main
	id="main"
	tabindex="-1"
	class="mx-auto flex w-full max-w-[var(--settings-max)] grow flex-col gap-10 px-[var(--content-x)] py-10 outline-none sm:py-14"
>
	<header class="flex flex-col gap-5">
		<a
			href="/"
			class={cn(
				helperBase,
				"hover:text-foreground focus-visible:outline-signal inline-flex w-fit touch-manipulation items-center gap-2 font-mono tracking-[0.18em] whitespace-nowrap uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
			)}
		>
			<ArrowLeft class="size-3.5" /> Back to invoices
		</a>
		<div class="flex flex-col gap-2">
			<Eyebrow>Settings</Eyebrow>
			<Heading as="h1" size="title-lg" weight={600}>Settings</Heading>
			<p class={cn(bodyBase, "max-w-prose text-pretty")}>
				Connect your own Cloudflare account to power the AI Copilot. This is
				<span class="text-foreground">required</span> to use the assistant — it runs on your own Cloudflare account.
			</p>
		</div>
	</header>

	<SettingsSection
		title="Cloudflare account"
		subtitle={connected ? "Connected — the Copilot is ready." : "Not connected — the Copilot is disabled."}
		icon={Cloud}
	>
		{#snippet header()}
			<span
				class={cn(
					"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-micro tracking-[0.14em] whitespace-nowrap uppercase",
					connected ? "border-signal/40 text-foreground" : "border-hair text-ink-muted"
				)}
			>
				<span class={cn("size-1.5 rounded-full", connected ? "bg-signal" : "bg-ink-muted")}></span>
				{connected ? "Live" : "Off"}
			</span>
		{/snippet}

		<form
			method="POST"
			action="?/save"
			class="flex flex-col gap-6"
			use:enhance={() => {
				saving = true;
				return async ({ update }) => {
					saving = false;
					token = "";
					await update({ reset: false });
				};
			}}
		>
			{#if form?.error}
				<p
					class="border-destructive/40 bg-destructive/10 text-destructive rounded-xl border px-4 py-3 text-xs text-pretty"
					role="alert"
				>
					{form.error}
				</p>
			{:else if form?.success}
				<p
					class="border-signal/40 text-foreground rounded-xl border px-4 py-3 text-xs text-pretty"
					role="status"
				>
					{form.message}
				</p>
			{/if}

			<SettingsRow label="API token" htmlFor="cf-token" stacked>
				<Input
					id="cf-token"
					type="password"
					name="cloudflareToken"
					bind:value={token}
					placeholder={maskedToken || "v1.0-…"}
					autocomplete="off"
					class="w-full"
				/>
				<p class={cn(helperBase, "mt-2")}>
					{#if connected && maskedToken}
						Stored: <span class="text-foreground font-mono wrap-break-word">{maskedToken}</span> — leave blank
						to keep it.
					{:else}
						An API token with the <span class="text-foreground">Account · Workers AI · Read</span>
						permission. Stored securely. You won't see it again after saving.
					{/if}
				</p>
			</SettingsRow>

			<SettingsRow label="Account ID" htmlFor="cf-account" stacked>
				<Input
					id="cf-account"
					name="cloudflareAccountId"
					bind:value={accountId}
					placeholder="0123456789abcdef…"
					autocomplete="off"
					class="w-full"
				/>
				<p class={cn(helperBase, "mt-2")}>
					Found in the right sidebar of any account page in the Cloudflare dashboard.
				</p>
			</SettingsRow>

			<SettingsRow
				label="Chat model"
				hint="Kimi K2.6 is recommended. Others are experimental and may be less reliable."
				htmlFor="cf-model"
			>
				<div class="flex items-center gap-2">
					<Select.Root type="single" name="cloudflareModel" bind:value={model}>
						<Select.Trigger
							id="cf-model"
							aria-label="Chat model"
							class={cn(
								inputBase,
								"flex h-auto w-full items-center justify-between gap-2 text-caption [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:opacity-60"
							)}
						>
							<span class="min-w-0 truncate text-left">{selectedModelLabel}</span>
						</Select.Trigger>
						<Select.Content
							class="border-hair bg-card max-h-72 w-(--bits-select-anchor-width) rounded-xl p-1 shadow-lg ring-0"
						>
							{#each modelOptions as opt (opt.id)}
								<Select.Item
									value={opt.id}
									label={opt.label}
									class="text-foreground data-highlighted:bg-ink-2 focus:bg-ink-2 ease-[var(--ease)] cursor-pointer rounded-lg px-2.5 py-2 text-caption transition-colors [&_.cn-select-item-indicator-icon]:text-signal"
								/>
							{/each}
						</Select.Content>
					</Select.Root>
					<button
						type="button"
						onclick={refreshModels}
						disabled={refreshing || !connected}
						title="Refresh model list"
						aria-label="Refresh models"
						class="text-ink-muted hover:text-foreground focus-visible:outline-signal shrink-0 touch-manipulation rounded-md p-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
					>
						<RefreshCw class={cn("size-3.5", refreshing && "animate-spin")} />
					</button>
				</div>
			</SettingsRow>

			<p class={cn(helperBase, "border-hair border-t pt-5")}>
				Create a token at
				<a
					href="https://dash.cloudflare.com/profile/api-tokens"
					target="_blank"
					rel="noreferrer"
					class="text-foreground underline underline-offset-2 wrap-break-word hover:text-signal"
					>dash.cloudflare.com/profile/api-tokens</a
				>
				→ Create Custom Token → permission
				<span class="text-foreground font-mono">Account · Workers AI · Read</span>.
			</p>

			<SettingsActions>
				{#snippet status()}
					{#if saving}
						Connecting…
					{:else if connected}
						Connected — leave the token blank to keep it.
					{:else}
						Not connected yet.
					{/if}
				{/snippet}
				<Cta type="submit" arrow={false} disabled={saving} class="touch-manipulation">
					{saving ? "Connecting…" : connected ? "Save changes" : "Connect account"}
				</Cta>
			</SettingsActions>
		</form>
	</SettingsSection>

	<SettingsSection
		title="Face ID / Touch ID"
		subtitle="Sign in with Face ID or Touch ID instead of Google."
		icon={Fingerprint}
	>
		{#if passkeyError}
			<p
				class="border-destructive/40 bg-destructive/10 text-destructive rounded-xl border px-4 py-3 text-xs text-pretty"
				role="alert"
			>
				{passkeyError}
			</p>
		{:else if passkeyMessage}
			<p
				class="border-signal/40 text-foreground rounded-xl border px-4 py-3 text-xs text-pretty"
				role="status"
			>
				{passkeyMessage}
			</p>
		{/if}

		{#if !webauthnAvailable}
			<p class={helperBase}>
				This browser can't use Face ID or Touch ID. Open the app in Safari, Chrome, or Edge on a device with
				Face ID or Touch ID.
			</p>
		{:else}
			{#if passkeysLoading}
				<p class={helperBase}>Loading…</p>
			{:else if passkeys.length === 0}
				<p class={helperBase}>Nothing set up yet. Add Face ID or Touch ID to sign in without Google.</p>
			{:else}
				<ul class="flex flex-col gap-2">
					{#each passkeys as pk (pk.id)}
						<li
							class="border-hair bg-ink-2/40 flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
						>
							<div class="flex min-w-0 items-center gap-2.5">
								<Fingerprint class="text-signal size-4 shrink-0" />
								<div class="min-w-0">
									<p class={cn(bodyBase, "truncate font-medium")}>
										{pk.name || "Face ID / Touch ID"}
									</p>
									{#if pk.createdAt && formatDate(pk.createdAt)}
										<p class={metaBase}>
											Added {formatDate(pk.createdAt)}
										</p>
									{/if}
								</div>
							</div>
							<button
								type="button"
								onclick={() => removePasskey(pk.id)}
								disabled={passkeyBusy}
								aria-label="Remove Face ID / Touch ID"
								class="text-ink-muted hover:text-destructive focus-visible:outline-signal shrink-0 touch-manipulation rounded-md p-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
							>
								<Trash2 class="size-3.5" />
							</button>
						</li>
					{/each}
				</ul>
			{/if}
			<SettingsActions>
				<Cta
					variant="compact"
					arrow={false}
					disabled={passkeyBusy}
					onclick={() => addPasskey()}
					class="touch-manipulation"
				>
					<span class="inline-flex items-center gap-2">
						<Fingerprint class="size-3.5" /> Set up Face ID / Touch ID
					</span>
				</Cta>
			</SettingsActions>
		{/if}
	</SettingsSection>

	{#if connected}
		<section
			class="border-hair/60 flex flex-col gap-3 rounded-2xl border border-dashed p-5 sm:flex-row sm:items-center sm:justify-between"
		>
			<div>
				<p class={cn(bodyBase, "font-medium")}>Disconnect</p>
				<p class={cn(helperBase, "mt-1")}>
					Removes your token and account ID. The Copilot is disabled until you reconnect.
				</p>
			</div>
			<form
				method="POST"
				action="?/reset"
				use:enhance={() =>
					async ({ update }) =>
						update({ reset: false })}
				onsubmit={e => {
					if (!confirm("Disconnect your Cloudflare account?")) e.preventDefault();
				}}
			>
				<Cta
					type="submit"
					variant="secondary"
					arrow={false}
					class="text-destructive touch-manipulation hover:border-destructive"
				>
					Disconnect
				</Cta>
			</form>
		</section>
	{/if}
</main>
