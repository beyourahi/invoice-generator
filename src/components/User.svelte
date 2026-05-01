<script lang="ts">
	import { authClient } from "$lib/auth-client";
	import { goto } from "$app/navigation";
	import { cn } from "$lib/utils";
	import type { CurrentUser } from "$lib/types";

	interface Props {
		user: {
			email: string;
			name: string;
			image?: string | null | undefined;
		};
		currentUser: CurrentUser;
	}

	let { user, currentUser }: Props = $props();

	let isLoggingOut = $state(false);
	let showTooltip = $state(false);
	let expanded = $state(false);

	const handleLogout = async () => {
		isLoggingOut = true;
		try {
			await authClient.signOut();
			goto("/login");
		} finally {
			isLoggingOut = false;
		}
	};
</script>

<div class="fixed top-4 right-4 z-50 flex items-center gap-2 sm:top-6 sm:right-6">
	<div
		class="group relative flex items-center"
		role="group"
		aria-label="User profile"
		onmouseenter={() => (expanded = true)}
		onmouseleave={() => (expanded = false)}
	>
		<div
			class={cn(
				"sleek relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold sm:h-10 sm:w-10",
				"border-border bg-card text-foreground border backdrop-blur-sm",
				user.image && "overflow-hidden p-0"
			)}
			aria-label={currentUser.name}
		>
			{#if user.image}
				<img src={user.image} alt={user.name} class="h-full w-full object-cover" referrerpolicy="no-referrer" />
			{:else}
				<svg
					class="h-4 w-4 sm:h-5 sm:w-5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
					<circle cx="12" cy="7" r="4" />
				</svg>
			{/if}
		</div>

		<div
			class={cn(
				"border-border bg-card absolute right-0 flex h-9 items-center overflow-hidden rounded-full border whitespace-nowrap backdrop-blur-sm transition-all duration-300 sm:h-10",
				expanded ? "w-auto pr-11 pl-3 opacity-100 sm:pr-12" : "w-0 pr-0 pl-0 opacity-0"
			)}
		>
			<div class="flex flex-col justify-center">
				<span class="text-foreground text-xs leading-tight font-medium sm:text-sm">
					{currentUser.name}
				</span>
				<span class="text-muted-foreground text-[10px] leading-tight sm:text-xs">
					{user.email}
				</span>
			</div>
		</div>
	</div>

	<div class="relative">
		<button
			onclick={handleLogout}
			disabled={isLoggingOut}
			onmouseenter={() => (showTooltip = true)}
			onmouseleave={() => (showTooltip = false)}
			onfocus={() => (showTooltip = true)}
			onblur={() => (showTooltip = false)}
			aria-label="Sign out"
			class={cn(
				"sleek group flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border backdrop-blur-sm sm:h-10 sm:w-10",
				"focus-visible:ring-destructive/50 focus:outline-none focus-visible:ring-2",
				isLoggingOut
					? "border-border bg-card cursor-wait"
					: "border-destructive/40 bg-destructive/10 hover:border-destructive hover:bg-destructive active:scale-95"
			)}
		>
			{#if isLoggingOut}
				<div
					class="border-muted-foreground h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
				></div>
			{:else}
				<svg
					class="text-destructive group-hover:text-destructive-foreground h-4 w-4 transition-colors sm:h-[1.125rem] sm:w-[1.125rem]"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
					<line x1="12" y1="2" x2="12" y2="12" />
				</svg>
			{/if}
		</button>

		{#if showTooltip && !isLoggingOut}
			<div
				class="bg-card text-card-foreground absolute top-full left-1/2 z-10 mt-2 -translate-x-1/2 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shadow-lg"
				role="tooltip"
			>
				Sign out
				<div
					class="border-b-card absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent"
				></div>
			</div>
		{/if}
	</div>
</div>
