<script lang="ts">
	import { authClient } from "$lib/auth-client";
	import { browser } from "$app/environment";
	import { page } from "$app/state";
	import { goto } from "$app/navigation";
	import Heading from "$lib/components/ui/heading/heading.svelte";

	let isLoading = $state(false);
	let error = $state<string | null>(null);

	const redirectUrl = $derived(page.url.searchParams.get("redirect") ?? "/");

	const session = authClient.useSession();
	$effect(() => {
		if (browser && $session.data?.user) {
			goto(redirectUrl);
		}
	});

	const handleGoogleLogin = async () => {
		isLoading = true;
		error = null;

		try {
			await authClient.signIn.social({
				provider: "google",
				callbackURL: redirectUrl
			});
		} catch (e) {
			error = "Failed to sign in with Google. Please try again.";
			console.error(e);
		} finally {
			isLoading = false;
		}
	};
</script>

<svelte:head>
	<title>Sign In - Invoice Generator</title>
</svelte:head>

<div class="flex grow flex-col items-center justify-center gap-8 overflow-hidden px-4 sm:gap-10 sm:px-6 lg:gap-12">
	<Heading />

	{#if error}
		<div
			class="max-w-xs rounded-lg bg-red-500/10 px-4 py-2.5 text-center text-xs text-red-400 sm:max-w-sm sm:text-sm"
		>
			{error}
		</div>
	{/if}

	<button
		onclick={handleGoogleLogin}
		disabled={isLoading}
		class="sleek group flex cursor-pointer items-center justify-center gap-2.5 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-medium text-zinc-200 backdrop-blur-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-3 sm:px-8 sm:py-3.5 xl:hover:border-white/20 xl:hover:bg-white/5"
	>
		{#if isLoading}
			<div
				class="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent sm:h-5 sm:w-5"
			></div>
		{:else}
			<svg class="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24">
				<path
					fill="#4285F4"
					d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
				/>
				<path
					fill="#34A853"
					d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
				/>
				<path
					fill="#FBBC05"
					d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
				/>
				<path
					fill="#EA4335"
					d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
				/>
			</svg>
		{/if}
		<span>Continue with Google</span>
	</button>

	<p class="max-w-xs text-center text-xs text-zinc-500 sm:max-w-none sm:text-sm">
		Only authorized accounts can access this application
	</p>
</div>
