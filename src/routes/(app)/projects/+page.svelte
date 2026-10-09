<script lang="ts">
	import { goto } from '$app/navigation';
	import { store } from '#lib/client/store.svelte.ts';
	import { counts } from '#lib/client/views.svelte.ts';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Icon from '#lib/components/Icon.svelte';

	let name = $state('');
	const archived = $derived(Object.values(store.projects).filter((p) => p.archivedAt));

	function add() {
		if (!name.trim()) return;
		const p = store.addProject(name);
		name = '';
		goto(`/projects/${p.id}`);
	}
</script>

<svelte:head><title>Projects · Tasker</title></svelte:head>

<div class="mx-auto max-w-3xl">
	<PageHeader title="Projects">
		{#snippet actions()}
			<a
				href="/board"
				class="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
				aria-label="Board"
				title="Board"><Icon name="board" class="size-5" /></a
			>
			<a
				href="/settings"
				class="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 lg:hidden dark:hover:bg-zinc-800"
				aria-label="Settings"><Icon name="settings" class="size-5" /></a
			>
		{/snippet}
	</PageHeader>

	<ul class="divide-y divide-zinc-100 dark:divide-zinc-800">
		<li>
			<a href="/upcoming" class="flex items-center gap-3 px-1 py-3 lg:hidden">
				<Icon name="upcoming" class="size-4 text-zinc-400" /> Upcoming
			</a>
		</li>
		{#each store.projectList as p (p.id)}
			<li>
				<a
					href="/projects/{p.id}"
					class="flex items-center gap-3 px-1 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
				>
					<span class="size-3 rounded-full" style:background={p.color}></span>
					<span class="flex-1 truncate">{p.name}</span>
					<span class="text-sm text-zinc-400">{counts.byProject[p.id] ?? ''}</span>
				</a>
			</li>
		{/each}
		<li class="flex items-center gap-3 px-1 py-2">
			<Icon name="plus" class="size-3 text-zinc-400" />
			<input
				bind:value={name}
				placeholder="New project"
				class="flex-1 bg-transparent py-1 outline-none placeholder:text-zinc-400"
				onkeydown={(e) => e.key === 'Enter' && add()}
				enterkeyhint="done"
			/>
		</li>
	</ul>

	{#if archived.length}
		<h2 class="mt-8 mb-1 px-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">
			Archived
		</h2>
		<ul class="divide-y divide-zinc-100 text-zinc-500 dark:divide-zinc-800">
			{#each archived as p (p.id)}
				<li class="flex items-center gap-3 px-1 py-2.5">
					<span class="size-3 rounded-full opacity-50" style:background={p.color}></span>
					<a href="/projects/{p.id}" class="flex-1 truncate">{p.name}</a>
					<button
						type="button"
						class="text-xs hover:text-zinc-800 dark:hover:text-zinc-200"
						onclick={() => store.updateProject(p.id, { archivedAt: null })}>Restore</button
					>
				</li>
			{/each}
		</ul>
	{/if}
</div>
