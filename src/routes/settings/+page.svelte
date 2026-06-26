<!--
	Settings — the BYO Cloudflare connection for the AI Copilot. Signed-in only (the
	loader redirects guests to /login). Built entirely from the vendored Dropout DS:
	Eyebrow/Heading/Input/Select/StatusBadge/Cta + bodyBase/helperBase, dark-canonical, editorial.
	Connecting an account is REQUIRED to use the Copilot; inference is billed to the user.
-->
<script lang="ts">
	import { untrack, onMount } from "svelte";
	import { enhance } from "$app/forms";
	import { invalidateAll } from "$app/navigation";
	import { authClient } from "$lib/auth-client";
	import { ArrowLeft, RefreshCw, Fingerprint, Trash2, Cloud, Check } from "@lucide/svelte";
	import {
		Eyebrow,
		Heading,
		Input,
		Select,
		StatusBadge,
		Cta,
		cn,
		bodyBase,
		helperBase,
		metaBase,
		SettingsSection,
		SettingsRow,
		SettingsActions,
		isPlatformAuthenticatorAvailable,
		detectPlatform,
		biometricLabel
	} from "$lib/ds";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	const DEFAULT_MODEL = "@cf/moonshotai/kimi-k2.6";

	const connected = $derived(data.connected);
	const maskedToken = $derived(data.maskedToken ?? "");

	// Editable fields are seeded ONCE from server data; `enhance({ reset: false })`
	// preserves them across submits, and a fresh load resets them via component re-key.
	let token = $state("");
	let accountId = $state(untrack(() => data.accountId ?? ""));
	let model = $state(untrack(() => data.model ?? DEFAULT_MODEL));
	let saving = $state(false);
	let saved = $state(false);
	let saveError = $state<string | null>(null);

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

	const modelItems = $derived(modelOptions.map(o => ({ value: o.id, label: o.label })));

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

	// ── Platform biometrics (WebAuthn) — device-accurate label + UVPAA-gated ─────────────────
	type PasskeyRow = { id: string; name?: string | null; createdAt?: string | Date | null };
	let passkeys = $state<PasskeyRow[]>([]);
	let passkeysLoading = $state(true);
	let passkeyBusy = $state(false);
	let bioSupported = $state(false);
	let passkeyError = $state<string | null>(null);

	// Device-accurate biometric name, seeded from the server platform hint (no label flash).
	const biometricName = biometricLabel(detectPlatform(untrack(() => data.platformHint)));

	// Friendly default name stored as the passkey label.
	const deviceLabel = () => biometricLabel(detectPlatform());

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

	onMount(async () => {
		bioSupported = await isPlatformAuthenticatorAvailable();
		if (bioSupported) loadPasskeys();
		else passkeysLoading = false;
	});

	// Always registers a platform biometric (Face ID / Touch ID; Windows Hello / Android
	// fingerprint) — `authenticatorAttachment: "platform"` excludes roaming security keys.
	const addPasskey = async () => {
		passkeyBusy = true;
		passkeyError = null;
		try {
			const res = await authClient.passkey.addPasskey({
				name: deviceLabel(),
				authenticatorAttachment: "platform"
			});
			if (res?.error) passkeyError = res.error.message || `Couldn't add ${biometricName}.`;
			else await loadPasskeys();
		} catch {
			passkeyError = "Setup was cancelled.";
		} finally {
			passkeyBusy = false;
		}
	};

	const removePasskey = async (id: string) => {
		if (!confirm(`Remove this ${biometricName}? You won't be able to sign in with it anymore.`)) return;
		passkeyBusy = true;
		passkeyError = null;
		try {
			const res = await authClient.passkey.deletePasskey({ id });
			if (res?.error) passkeyError = res.error.message || "Couldn't remove it.";
			else await loadPasskeys();
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
	class="mx-auto flex w-full max-w-[var(--settings-max)] grow flex-col gap-10 px-[var(--content-pad)] py-10 outline-none sm:py-14"
>
	<div class="flex justify-end">
		<Cta
			href="/"
			variant="secondary"
			size="sm"
			arrow={false}
			class="w-full justify-center whitespace-nowrap sm:w-auto"
		>
			<span class="inline-flex items-center gap-2">
				<ArrowLeft class="size-4" aria-hidden="true" />
				Back to app
			</span>
		</Cta>
	</div>

	<header class="flex flex-col gap-2.5">
		<Eyebrow>Settings</Eyebrow>
		<Heading as="h1" size="title-lg" weight={600} class="lg:text-title">Settings</Heading>
		<p class={cn(bodyBase, "max-w-prose")}>
			Connect your own Cloudflare account to power the AI Copilot. This is
			<span class="text-foreground">required</span> to use the assistant — it runs on your own Cloudflare account.
		</p>
	</header>

	<SettingsSection
		title="Cloudflare account"
		subtitle="Bring your own Cloudflare account to power the AI features."
		icon={Cloud}
	>
		{#snippet header()}
			<StatusBadge {connected} />
		{/snippet}

		<form
			method="POST"
			action="?/save"
			class="flex flex-col gap-6"
			use:enhance={() => {
				saving = true;
				saved = false;
				saveError = null;
				return async ({ result, update }) => {
					saving = false;
					if (result.type === "success") {
						saved = true;
						token = "";
					} else if (result.type === "failure") {
						saveError = (result.data as { error?: string } | undefined)?.error ?? "Couldn't save.";
					}
					await update({ reset: false });
				};
			}}
		>
			<SettingsRow label="API token" htmlFor="cf-token" stacked>
				<Input
					id="cf-token"
					name="cloudflareToken"
					type="password"
					bind:value={token}
					placeholder={maskedToken || "v1.0-…"}
					autocomplete="off"
					spellcheck="false"
					class="w-full"
				/>
				<p class={cn(helperBase, "mt-2")}>
					{#if connected}
						Stored: <span class="text-foreground font-mono break-all">{maskedToken}</span> — leave blank to keep
						it.
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
					spellcheck="false"
					class="w-full"
				/>
				<p class={cn(helperBase, "mt-2")}>
					Found in the right sidebar of any account page in the Cloudflare dashboard.
				</p>
			</SettingsRow>

			<SettingsRow label="Model" htmlFor="cf-model" stacked>
				<div class="flex min-w-0 items-center gap-2">
					<button
						type="button"
						onclick={refreshModels}
						disabled={refreshing || !connected}
						title="Refresh model list"
						aria-label="Refresh models"
						class="text-ink-muted hover:text-foreground grid size-9 shrink-0 touch-manipulation place-items-center rounded-[9px] transition-colors disabled:opacity-40 pointer-coarse:size-11"
					>
						<RefreshCw class={cn("size-4", refreshing && "animate-spin")} aria-hidden="true" />
					</button>
					<Select
						id="cf-model"
						name="cloudflareModel"
						bind:value={model}
						items={modelItems}
						placeholder="Select a model"
						class="w-full"
					/>
				</div>
				<p class={cn(helperBase, "mt-2")}>
					Kimi K2.6 is recommended. Others are experimental and may be less reliable.
				</p>
			</SettingsRow>

			{#if saved}
				<p class="text-status-connected inline-flex items-center gap-1.5 text-caption" role="status">
					<Check class="size-3.5" aria-hidden="true" /> Saved.
				</p>
			{:else if saveError}
				<p class="text-destructive text-caption text-pretty" role="alert">{saveError}</p>
			{/if}

			<SettingsActions>
				{#snippet status()}
					<p class={cn(helperBase, "max-w-prose")}>
						Create a token at
						<a
							href="https://dash.cloudflare.com/profile/api-tokens"
							target="_blank"
							rel="noreferrer"
							class="text-foreground underline underline-offset-2 break-all"
						>
							dash.cloudflare.com/profile/api-tokens
						</a>
						→ Create Custom Token → permission
						<span class="text-foreground font-mono">Account · Workers AI · Read</span>.
					</p>
				{/snippet}
				<Cta
					type="submit"
					size="sm"
					variant="primary"
					arrow={false}
					disabled={saving}
					class="w-full justify-center whitespace-nowrap sm:w-auto"
				>
					{saving ? "Saving…" : "Save"}
				</Cta>
			</SettingsActions>
		</form>

		{#if connected}
			<div class="border-hair flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
				<div class="min-w-0">
					<p class={cn(bodyBase, "font-medium")}>Disconnect</p>
					<p class={cn(helperBase, "mt-1 max-w-prose")}>
						Removes your saved token and account ID. The AI features stay off until you reconnect.
					</p>
				</div>
				<form
					method="POST"
					action="?/reset"
					class="shrink-0"
					use:enhance={() => {
						saved = false;
						saveError = null;
						return async ({ result, update }) => {
							if (result.type === "failure") {
								saveError =
									(result.data as { error?: string } | undefined)?.error ?? "Couldn't disconnect.";
							}
							await update({ reset: false });
						};
					}}
					onsubmit={e => {
						if (
							!confirm(
								"Disconnect your Cloudflare account? The AI features will stop working until you reconnect."
							)
						)
							e.preventDefault();
					}}
				>
					<Cta
						type="submit"
						size="sm"
						variant="secondary"
						arrow={false}
						class="text-destructive w-full justify-center whitespace-nowrap sm:w-auto"
					>
						<span class="inline-flex items-center gap-2">
							<Trash2 class="size-3.5" aria-hidden="true" />
							Disconnect
						</span>
					</Cta>
				</form>
			</div>
		{/if}
	</SettingsSection>

	{#if bioSupported}
		<SettingsSection
			title={biometricName}
			subtitle={"Sign in with " + biometricName + " instead of Google."}
			icon={Fingerprint}
		>
			{#if passkeysLoading}
				<p class={helperBase}>Loading…</p>
			{:else if passkeys.length === 0}
				<p class={cn(helperBase, "max-w-prose")}>
					Not set up yet. Add {biometricName} to sign in without Google.
				</p>
			{:else}
				<ul class="flex flex-col gap-2">
					{#each passkeys as pk (pk.id)}
						<li
							class="border-hair bg-ink-2/40 flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
						>
							<div class="flex min-w-0 items-center gap-2.5">
								<Fingerprint size={15} class="text-signal shrink-0" aria-hidden="true" />
								<div class="min-w-0">
									<p class="text-foreground truncate text-sm font-medium">
										{pk.name || biometricName}
									</p>
									{#if pk.createdAt && formatDate(pk.createdAt)}
										<p class={metaBase}>Added {formatDate(pk.createdAt)}</p>
									{/if}
								</div>
							</div>
							<button
								type="button"
								onclick={() => removePasskey(pk.id)}
								disabled={passkeyBusy}
								aria-label={"Remove " + biometricName}
								class="text-ink-muted hover:text-destructive grid size-9 shrink-0 touch-manipulation place-items-center rounded-[9px] transition-colors disabled:opacity-40 pointer-coarse:size-11"
							>
								<Trash2 size={14} aria-hidden="true" />
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			{#if passkeyError}
				<p class="text-destructive text-caption text-pretty" role="alert">{passkeyError}</p>
			{/if}

			<SettingsActions>
				<Cta
					size="sm"
					variant="primary"
					arrow={false}
					disabled={passkeyBusy}
					onclick={() => addPasskey()}
					class="w-full justify-center whitespace-nowrap sm:w-auto"
				>
					<span class="inline-flex items-center gap-2">
						<Fingerprint size={14} aria-hidden="true" />
						Set up {biometricName}
					</span>
				</Cta>
			</SettingsActions>
		</SettingsSection>
	{/if}
</main>
