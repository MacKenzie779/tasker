<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { store } from '#lib/client/store.svelte.ts';
	import { ui } from '#lib/client/ui.svelte.ts';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const base = $derived(`${page.url.origin}/ics/${data.icsToken}.ics`);
	const feeds = $derived([
		{ label: 'All tasks', url: base },
		...store.projectList.map((p) => ({
			label: p.name,
			url: `${base}?project=${p.id}`,
			color: p.color
		}))
	]);

	async function copy(url: string) {
		try {
			await navigator.clipboard.writeText(url);
			ui.toast('Link copied');
		} catch {
			prompt('Copy this link', url);
		}
	}
	const webcal = (url: string) => url.replace(/^https?:/, 'webcal:');
	const card = 'rounded-xl border border-zinc-200 p-4 dark:border-zinc-800';
</script>

<svelte:head><title>Settings · Tasker</title></svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
	<PageHeader title="Settings" />

	<section id="calendar" class={card}>
		<h2 class="font-semibold">Calendar feed</h2>
		<p class="mt-1 mb-3 text-sm text-zinc-500">
			Subscribe in Google Calendar, Apple Calendar, Outlook or Thunderbird. Planned tasks show on
			their day (or as a 30-min block when they have a time); deadlines show as ⚑ all-day events.
			Anyone with a link can read it.
		</p>
		<ul class="divide-y divide-zinc-100 dark:divide-zinc-800">
			{#each feeds as feed (feed.url)}
				<li class="flex items-center gap-2 py-2 text-sm">
					{#if 'color' in feed}<span class="size-2.5 rounded-full" style:background={feed.color}
						></span>{/if}
					<span class="flex-1 truncate">{feed.label}</span>
					<a
						href={webcal(feed.url)}
						class="rounded-md px-2 py-1 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
						>Subscribe</a
					>
					<button
						type="button"
						class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
						onclick={() => copy(feed.url)}
					>
						<Icon name="copy" class="size-3.5" /> Copy
					</button>
				</li>
			{/each}
		</ul>
		<form method="POST" action="?/regenerate" use:enhance class="mt-3">
			<button
				class="text-sm text-zinc-500 underline-offset-2 hover:text-red-600 hover:underline"
				onclick={(e) =>
					!confirm('Create new links? Existing subscriptions stop working.') && e.preventDefault()}
			>
				Reset links
			</button>
		</form>
	</section>

	<section class={card}>
		<h2 class="font-semibold">Install</h2>
		<p class="mt-1 text-sm text-zinc-500">
			On your phone, open this site and choose “Add to Home Screen” (iOS: Share menu). Text shared
			to Tasker from other apps lands in the Inbox.
		</p>
	</section>

	<section class={card}>
		<h2 class="mb-2 font-semibold">Help</h2>
		<button
			type="button"
			class="text-sm text-indigo-600 dark:text-indigo-400"
			onclick={() => (ui.helpOpen = true)}
		>
			Keyboard shortcuts & typing shortcuts
		</button>
	</section>

	{#if data.authEnabled}
		<form method="POST" action="?/logout">
			<button
				class="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
			>
				<Icon name="logout" /> Sign out
			</button>
		</form>
	{/if}
</div>
