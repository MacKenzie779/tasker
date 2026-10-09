<script lang="ts">
	import type { Task } from '#lib/types.ts';
	import { store } from '#lib/client/store.svelte.ts';
	import { ui } from '#lib/client/ui.svelte.ts';
	import Board from '#lib/components/Board.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';

	/** undefined = everything, '' = Inbox, otherwise a project id */
	let selected = $state<string | undefined>(undefined);

	const match = $derived((t: Task) => selected === undefined || (t.projectId ?? '') === selected);
	const defaults = $derived(() => ({ projectId: selected || null }));

	ui.useCaptureContext(() => ({
		label: selected ? (store.projects[selected]?.name ?? 'Project') : 'Inbox',
		defaults: { projectId: selected || null }
	}));

	const pill = (on: boolean) => [
		'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm',
		on
			? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
			: 'border-zinc-200 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300'
	];
</script>

<svelte:head><title>Board · Tasker</title></svelte:head>

<div class="mx-auto max-w-6xl">
	<PageHeader title="Board" />
	<div class="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
		<button
			type="button"
			class={pill(selected === undefined)}
			onclick={() => (selected = undefined)}>All</button
		>
		<button type="button" class={pill(selected === '')} onclick={() => (selected = '')}
			>Inbox</button
		>
		{#each store.projectList as p (p.id)}
			<button type="button" class={pill(selected === p.id)} onclick={() => (selected = p.id)}>
				<span class="size-2 rounded-full" style:background={p.color}></span>{p.name}
			</button>
		{/each}
	</div>
	<Board {match} {defaults} showProject={selected === undefined} />
</div>
