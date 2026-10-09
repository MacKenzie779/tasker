<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { store } from '#lib/client/store.svelte.ts';
	import { ui } from '#lib/client/ui.svelte.ts';
	import { counts } from '#lib/client/views.svelte.ts';
	import Icon, { type IconName } from './Icon.svelte';
	import SyncStatus from './SyncStatus.svelte';
	import { focusOnMount } from '#lib/client/autosize.ts';

	const nav: { href: string; label: string; icon: IconName; count?: () => number }[] = [
		{ href: '/inbox', label: 'Inbox', icon: 'inbox', count: () => counts.inbox },
		{ href: '/today', label: 'Today', icon: 'sun', count: () => counts.today },
		{ href: '/upcoming', label: 'Upcoming', icon: 'upcoming' },
		{ href: '/calendar', label: 'Calendar', icon: 'calendar' },
		{ href: '/board', label: 'Board', icon: 'board' }
	];

	let adding = $state(false);
	let newName = $state('');

	function addProject() {
		const name = newName.trim();
		adding = false;
		newName = '';
		if (!name) return;
		const p = store.addProject(name);
		goto(`/projects/${p.id}`);
	}

	const active = (href: string) =>
		page.url.pathname === href || page.url.pathname.startsWith(href + '/');
	const link = (on: boolean) => [
		'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
		on
			? 'bg-zinc-200/70 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-white'
			: 'text-zinc-600 hover:bg-zinc-200/40 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100'
	];
</script>

<aside
	class="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 px-3 py-4 lg:flex dark:border-zinc-800 dark:bg-zinc-900/40"
>
	<div class="mb-4 flex items-center gap-2 px-2.5 font-semibold">
		<img src="/icon.svg" alt="" class="size-6" /> Tasker
	</div>

	<button
		type="button"
		class="mb-4 flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
		onclick={() => (ui.captureOpen = true)}
	>
		<Icon name="plus" /> New task <kbd class="ml-auto rounded bg-white/20 px-1.5 text-xs">n</kbd>
	</button>

	<nav class="space-y-0.5">
		{#each nav as item (item.href)}
			<a href={item.href} class={link(active(item.href))}>
				<Icon name={item.icon} />
				{item.label}
				{#if item.count?.()}<span class="ml-auto text-xs text-zinc-400">{item.count()}</span>{/if}
			</a>
		{/each}
	</nav>

	<div
		class="mt-6 mb-1 flex items-center justify-between px-2.5 text-xs font-medium tracking-wide text-zinc-500 uppercase"
	>
		<a href="/projects" class="hover:text-zinc-800 dark:hover:text-zinc-200">Projects</a>
		<button
			type="button"
			class="rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800"
			onclick={() => (adding = true)}
			aria-label="New project"
		>
			<Icon name="plus" class="size-3.5" />
		</button>
	</div>
	<nav class="-mr-1 flex-1 space-y-0.5 overflow-y-auto pr-1">
		{#each store.projectList as p (p.id)}
			<a href="/projects/{p.id}" class={link(active(`/projects/${p.id}`))}>
				<span class="ml-1 size-2.5 shrink-0 rounded-full" style:background={p.color}></span>
				<span class="truncate">{p.name}</span>
				{#if counts.byProject[p.id]}<span class="ml-auto text-xs text-zinc-400"
						>{counts.byProject[p.id]}</span
					>{/if}
			</a>
		{/each}
		{#if adding}
			<input
				class="w-full rounded-md border border-indigo-400 bg-white px-2.5 py-1.5 text-sm outline-none dark:bg-zinc-900"
				placeholder="Project name"
				bind:value={newName}
				use:focusOnMount
				onkeydown={(e) => {
					if (e.key === 'Enter') addProject();
					if (e.key === 'Escape') ((adding = false), (newName = ''));
				}}
				onblur={addProject}
			/>
		{/if}
	</nav>

	<div class="mt-3 flex items-center gap-1 border-t border-zinc-200 pt-3 dark:border-zinc-800">
		<a href="/settings" class={[link(active('/settings')), 'flex-1']}
			><Icon name="settings" /> Settings</a
		>
		<SyncStatus />
		<button
			type="button"
			class="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
			onclick={() => (ui.helpOpen = true)}
			aria-label="Help"
			title="Help (?)"
		>
			<Icon name="help" />
		</button>
	</div>
</aside>
