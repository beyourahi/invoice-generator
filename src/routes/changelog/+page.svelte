<!--
	Public changelog page. Renders the static CHANGELOG_ENTRIES grouped by date
	(newest first; the array is already newest-first so no sort runs here). No
	+page.server.ts sits beside this file, which keeps the route public — there is
	no auth guard. Dates are formatted absolutely (SSR-safe; never relative) so
	server and client output match.
-->
<script lang="ts">
	import { CHANGELOG_ENTRIES, type ChangelogEntry } from "$lib/data/changelog";
	import { Card, CardContent } from "$lib/components/ui/card";
	import { Separator } from "$lib/components/ui/separator";
	import SectionEyebrow from "$src/components/SectionEyebrow.svelte";
	import { reveal } from "$lib/motion";
	import { Sparkles } from "@lucide/svelte";

	type DateGroup = { date: string; label: string; entries: ChangelogEntry[] };

	const dateFormatter = new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric"
	});

	// Preserve the source order (newest first) while collapsing consecutive
	// entries that share a date into a single dated group.
	const groups: DateGroup[] = (() => {
		const out: DateGroup[] = [];
		for (const entry of CHANGELOG_ENTRIES) {
			const last = out[out.length - 1];
			if (last && last.date === entry.date) {
				last.entries.push(entry);
				continue;
			}
			out.push({
				date: entry.date,
				label: dateFormatter.format(new Date(`${entry.date}T00:00:00`)),
				entries: [entry]
			});
		}
		return out;
	})();
</script>

<svelte:head>
	<title>Changelog · Invoice Generator</title>
	<meta
		name="description"
		content="A plain-language record of every meaningful update to Invoice Generator — new features, improvements, and fixes."
	/>
</svelte:head>

<main class="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
	<header class="space-y-3 text-center sm:space-y-4" use:reveal={{ distance: "sm" }}>
		<div class="flex justify-center">
			<span
				class="border-border bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-caption font-medium"
			>
				<Sparkles size={13} aria-hidden="true" />
				What's new
			</span>
		</div>
		<h1 class="text-title-sm font-semibold tracking-tight text-balance sm:text-title">Changelog</h1>
		<p class="text-muted-foreground mx-auto max-w-md text-label text-pretty sm:text-body">
			Every meaningful update to Invoice Generator, written in plain language.
		</p>
	</header>

	<Separator class="my-10 sm:my-12" />

	<div class="space-y-12 sm:space-y-16">
		{#each groups as group, groupIndex (group.date)}
			<section class="space-y-5">
				<div
					class="flex flex-wrap items-center gap-x-3 gap-y-2"
					use:reveal={{ distance: "sm", delay: groupIndex === 0 ? 0.05 : 0 }}
				>
					<SectionEyebrow icon={Sparkles} label={group.label} />
					{#if groupIndex === 0}
						<span
							class="border-border text-foreground rounded-full border px-2 py-0.5 text-micro font-medium tracking-wide uppercase"
						>
							Latest
						</span>
					{/if}
				</div>

				<div class="space-y-4">
					{#each group.entries as entry, entryIndex (entry.title)}
						<div use:reveal={{ distance: "sm", delay: 0.06 * entryIndex }}>
							<Card>
								<CardContent class="space-y-2.5">
									<span
										class="border-border bg-muted text-muted-foreground inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-caption"
									>
										{entry.category}
									</span>
									<h2 class="text-lead font-semibold tracking-tight text-balance">
										{entry.title}
									</h2>
									<p class="text-muted-foreground text-label leading-relaxed text-pretty">
										{entry.summary}
									</p>
								</CardContent>
							</Card>
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</main>
