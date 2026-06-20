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
	import { ArrowLeft, RefreshCw, Fingerprint, KeyRound, Trash2 } from "@lucide/svelte";
	import { Eyebrow, Heading, Input, Cta, cn, inputBase, labelBase } from "$lib/ds";
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

	// ── Passkeys (WebAuthn = device biometrics: Face ID / Touch ID / fingerprint) ──────────
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

	// attachment "platform" → device biometric (Face ID / Touch ID / fingerprint);
	// omitted → browser default (allows roaming security keys too).
	const addPasskey = async (attachment?: "platform") => {
		passkeyBusy = true;
		passkeyError = null;
		passkeyMessage = null;
		try {
			const res = await authClient.passkey.addPasskey({
				name: deviceLabel(),
				...(attachment ? { authenticatorAttachment: attachment } : {})
			});
			if (res?.error) passkeyError = res.error.message || "Couldn't add passkey.";
			else {
				passkeyMessage = "Passkey added.";
				await loadPasskeys();
			}
		} catch {
			passkeyError = "Passkey registration was cancelled.";
		} finally {
			passkeyBusy = false;
		}
	};

	const removePasskey = async (id: string) => {
		if (!confirm("Remove this passkey? You won't be able to sign in with it anymore.")) return;
		passkeyBusy = true;
		passkeyError = null;
		passkeyMessage = null;
		try {
			const res = await authClient.passkey.deletePasskey({ id });
			if (res?.error) passkeyError = res.error.message || "Couldn't remove passkey.";
			else {
				passkeyMessage = "Passkey removed.";
				await loadPasskeys();
			}
		} catch {
			passkeyError = "Couldn't remove passkey.";
		} finally {
			passkeyBusy = false;
		}
	};
</script>

<svelte:head>
	<title>Settings · Invoice Generator</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-2xl grow flex-col gap-10 px-4 pt-10 pb-16 sm:px-6 sm:pt-14">
	<header class="flex flex-col gap-5">
		<a
			href="/"
			class="text-ink-muted hover:text-foreground focus-visible:outline-signal inline-flex w-fit items-center gap-2 font-mono text-[11px] tracking-[0.18em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
		>
			<ArrowLeft class="size-3.5" /> Back to invoices
		</a>
		<div class="flex flex-col gap-2">
			<Eyebrow>Copilot</Eyebrow>
			<Heading as="h1" size="title-lg">Settings</Heading>
			<p class="text-ink-muted max-w-prose text-sm text-pretty">
				Connect your own Cloudflare account to power the AI Copilot. This is
				<span class="text-foreground">required</span> to use the assistant — every request runs on your account and
				is billed to you.
			</p>
		</div>
	</header>

	<section class="border-hair bg-card overflow-hidden rounded-2xl border">
		<header class="border-hair flex items-center gap-3 border-b px-5 py-4">
			<span class="bg-ink-2 border-hair text-ink-muted flex size-8 items-center justify-center rounded-lg border">
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					class="size-4"
					aria-hidden="true"
				>
					<path
						d="M17.5 19a4.5 4.5 0 0 0 .9-8.91 5.5 5.5 0 0 0-10.6-1.46A4 4 0 1 0 6.5 19h11Z"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</span>
			<div>
				<h2 class="text-foreground text-sm font-semibold tracking-tight">Cloudflare account</h2>
				<p class="text-ink-muted mt-0.5 text-[11px]">
					{connected ? "Connected — the Copilot is ready." : "Not connected — the Copilot is disabled."}
				</p>
			</div>
			<span
				class={cn(
					"ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] uppercase",
					connected ? "border-signal/40 text-foreground" : "border-hair text-ink-muted"
				)}
			>
				<span class={cn("size-1.5 rounded-full", connected ? "bg-signal" : "bg-ink-muted")}></span>
				{connected ? "Live" : "Off"}
			</span>
		</header>

		<form
			method="POST"
			action="?/save"
			class="flex flex-col gap-6 p-5"
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

			<div>
				<label class={labelBase} for="cf-token">API token</label>
				<Input
					id="cf-token"
					type="password"
					name="cloudflareToken"
					bind:value={token}
					placeholder={maskedToken || "v1.0-…"}
					autocomplete="off"
				/>
				<p class="text-ink-muted mt-2 text-[11px] text-pretty">
					{connected && maskedToken
						? `Stored: ${maskedToken} — leave blank to keep it.`
						: "Scoped token with the Account · Workers AI · Read permission. Encrypted at rest."}
				</p>
			</div>

			<div>
				<label class={labelBase} for="cf-account">Account ID</label>
				<Input
					id="cf-account"
					name="cloudflareAccountId"
					bind:value={accountId}
					placeholder="0123456789abcdef…"
					autocomplete="off"
				/>
				<p class="text-ink-muted mt-2 text-[11px] text-pretty">
					Right sidebar of any account page in the Cloudflare dashboard.
				</p>
			</div>

			<div class="border-hair flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-end sm:justify-between">
				<div class="min-w-0">
					<label class={labelBase} for="cf-model">Chat model</label>
					<p class="text-ink-muted text-[11px] text-pretty">
						Kimi K2.6 is the recommended default. Others are experimental — quality varies.
					</p>
				</div>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={refreshModels}
						disabled={refreshing || !connected}
						title="Refresh model list"
						aria-label="Refresh models"
						class="text-ink-muted hover:text-foreground focus-visible:outline-signal rounded-md p-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
					>
						<RefreshCw class={cn("size-3.5", refreshing && "animate-spin")} />
					</button>
					<div class="w-full sm:w-80">
						<select
							id="cf-model"
							name="cloudflareModel"
							bind:value={model}
							class={cn(inputBase, "appearance-none text-[11px]")}
						>
							{#each modelOptions as opt (opt.id)}
								<option value={opt.id}>{opt.label}</option>
							{/each}
						</select>
					</div>
				</div>
			</div>

			<p class="text-ink-muted text-[11px] leading-relaxed text-pretty">
				Create a token at
				<a
					href="https://dash.cloudflare.com/profile/api-tokens"
					target="_blank"
					rel="noreferrer"
					class="text-foreground underline underline-offset-2 hover:text-signal"
					>dash.cloudflare.com/profile/api-tokens</a
				>
				→ Create Custom Token → permission
				<span class="text-foreground font-mono">Account · Workers AI · Read</span>.
			</p>

			<div class="flex items-center justify-end gap-3">
				<Cta type="submit" arrow={false} disabled={saving}>
					{saving ? "Connecting…" : connected ? "Save changes" : "Connect account"}
				</Cta>
			</div>
		</form>
	</section>

	<section class="border-hair bg-card overflow-hidden rounded-2xl border">
		<header class="border-hair flex items-center gap-3 border-b px-5 py-4">
			<span class="bg-ink-2 border-hair text-ink-muted flex size-8 items-center justify-center rounded-lg border">
				<Fingerprint class="size-4" aria-hidden="true" />
			</span>
			<div>
				<h2 class="text-foreground text-sm font-semibold tracking-tight">Passkeys</h2>
				<p class="text-ink-muted mt-0.5 text-[11px]">
					Sign in with Face ID, Touch ID, or a fingerprint instead of Google.
				</p>
			</div>
		</header>

		<div class="flex flex-col gap-4 p-5">
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
				<p class="text-ink-muted text-xs text-pretty">
					This browser can't use passkeys. Open the app in Safari, Chrome, or Edge on a device with Face ID,
					Touch ID, or a fingerprint sensor.
				</p>
			{:else}
				{#if passkeysLoading}
					<p class="text-ink-muted text-xs">Loading passkeys…</p>
				{:else if passkeys.length === 0}
					<p class="text-ink-muted text-xs text-pretty">
						No passkeys yet. Add one to sign in with Face ID, Touch ID, or your fingerprint instead of
						Google.
					</p>
				{:else}
					<ul class="flex flex-col gap-2">
						{#each passkeys as pk (pk.id)}
							<li
								class="border-hair bg-ink-2/40 flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
							>
								<div class="flex min-w-0 items-center gap-2.5">
									<Fingerprint class="text-signal size-4 shrink-0" />
									<div class="min-w-0">
										<p class="text-foreground truncate text-sm font-medium">
											{pk.name || "Passkey"}
										</p>
										{#if pk.createdAt && formatDate(pk.createdAt)}
											<p class="text-ink-muted text-[11px]">Added {formatDate(pk.createdAt)}</p>
										{/if}
									</div>
								</div>
								<button
									type="button"
									onclick={() => removePasskey(pk.id)}
									disabled={passkeyBusy}
									aria-label="Remove passkey"
									class="text-ink-muted hover:text-destructive focus-visible:outline-signal shrink-0 rounded-md p-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
								>
									<Trash2 class="size-3.5" />
								</button>
							</li>
						{/each}
					</ul>
				{/if}
				<div class="flex flex-wrap items-center gap-2 pt-1">
					<Cta variant="compact" arrow={false} disabled={passkeyBusy} onclick={() => addPasskey("platform")}>
						<span class="inline-flex items-center gap-2">
							<Fingerprint class="size-3.5" /> Set up Face ID / Touch ID
						</span>
					</Cta>
					<Cta variant="secondary" arrow={false} disabled={passkeyBusy} onclick={() => addPasskey()}>
						<span class="inline-flex items-center gap-2">
							<KeyRound class="size-3.5" /> Use a security key
						</span>
					</Cta>
				</div>
			{/if}
		</div>
	</section>

	{#if connected}
		<section
			class="border-hair/60 flex flex-col gap-3 rounded-2xl border border-dashed p-5 sm:flex-row sm:items-center sm:justify-between"
		>
			<div>
				<p class="text-foreground text-sm font-medium">Disconnect</p>
				<p class="text-ink-muted mt-1 text-[11px] text-pretty">
					Removes the encrypted token and account ID. The Copilot is disabled until you reconnect.
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
				<Cta type="submit" variant="secondary" arrow={false} class="text-destructive hover:border-destructive">
					Disconnect
				</Cta>
			</form>
		</section>
	{/if}
</main>
