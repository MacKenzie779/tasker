<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { PROJECT_COLORS } from '#lib/types.ts';
	import { store } from '#lib/client/store.svelte.ts';
	import { ui } from '#lib/client/ui.svelte.ts';
	import { filters } from '#lib/client/views.svelte.ts';
	import Outliner from '#lib/components/Outliner.svelte';
	import Board from '#lib/components/Board.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Icon from '#lib/components/Icon.svelte';

	const id = $derived(page.params.id!);
	const project = $derived(store.projects[id]);
	const view = $derived(page.url.searchParams.get('view') === 'board' ? 'board' : 'list');
	let showDone = $state(false);
	let menuOpen = $state(false);

	ui.useCaptureContext(() => ({ label: project?.name ?? 'Project', defaults: { projectId: id } }));

	const doneCount = $derived(
		Object.values(store.tasks).filter(
			(t) => t.projectId === id && !t.parentId && t.status === 'done'
		).length
	);

	function cycleColor() {
		const i = PROJECT_COLORS.indexOf(project.color);
		store.updateProject(id, { color: PROJECT_COLORS[(i + 1) % PROJECT_COLORS.length] });
	}

	function archive() {
		menuOpen = false;
		store.updateProject(id, { archivedAt: project.archivedAt ? null : Date.now() });
		if (!project.archivedAt) return;
		ui.toast(`Archived “${project.name}”`, {
			label: 'Undo',
			run: () => store.updateProject(id, { archivedAt: null })
		});
		goto('/projects');
	}

	function remove() {
		menuOpen = false;
		const n = Object.values(store.tasks).filter((t) => t.projectId === id).length;
		if (!confirm(`Delete “${project.name}” and its ${n} task(s)? This can't be undone.`)) return;
		store.deleteProject(id);
		goto('/projects');
	}

	const tab = (on: boolean) => [
		'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium',
		on
			? 'bg-white shadow-sm dark:bg-zinc-700'
			: 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
	];
</script>

<svelte:head><title>{project?.name ?? 'Project'} · Tasker</title></svelte:head>

{#if project}
	<div class={['mx-auto', view === 'board' ? 'max-w-6xl' : 'max-w-3xl']}>
		<PageHeader>
			{#snippet leading()}
				<button
					type="button"
					class="size-4 shrink-0 rounded-full ring-offset-2 hover:ring-2 hover:ring-zinc-300 dark:ring-offset-zinc-950"
					style:background={project.color}
					onclick={cycleColor}
					aria-label="Change colour"
					title="Change colour"
				></button>
			{/snippet}
			<input
				class="w-full truncate bg-transparent text-xl font-bold tracking-tight outline-none lg:text-2xl"
				value={project.name}
				onchange={(e) =>
					store.updateProject(id, { name: e.currentTarget.value.trim() || project.name })}
				onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
				aria-label="Project name"
			/>
			{#snippet actions()}
				<div class="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
					<a href="?view=list" class={tab(view === 'list')} data-sveltekit-replacestate
						><Icon name="list" class="size-3.5" /><span class="hidden sm:inline">List</span></a
					>
					<a href="?view=board" class={tab(view === 'board')} data-sveltekit-replacestate
						><Icon name="board" class="size-3.5" /><span class="hidden sm:inline">Board</span></a
					>
				</div>
				<div class="relative">
					<button
						type="button"
						class="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
						onclick={() => (menuOpen = !menuOpen)}
						aria-label="Project menu"
					>
						<Icon name="settings" />
					</button>
					{#if menuOpen}
						<div
							class="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-zinc-200 bg-white p-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
						>
							{#if view === 'list'}
								<button
									type="button"
									class="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
									onclick={() => ((showDone = !showDone), (menuOpen = false))}
								>
									<Icon name="check" />
									{showDone ? 'Hide' : 'Show'} completed ({doneCount})
								</button>
							{/if}
							<button
								type="button"
								class="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
								onclick={archive}
							>
								<Icon name="archive" />
								{project.archivedAt ? 'Unarchive' : 'Archive'}
							</button>
							<a
								href="/settings#calendar"
								class="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
							>
								<Icon name="calendar" /> Calendar feed
							</a>
							<button
								type="button"
								class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
								onclick={remove}
							>
								<Icon name="trash" /> Delete project
							</button>
						</div>
					{/if}
				</div>
			{/snippet}
		</PageHeader>

		{#if view === 'board'}
			<Board match={filters.project(id)} defaults={() => ({ projectId: id })} />
		{:else}
			<Outliner
				filter={filters.project(id)}
				defaults={() => ({ projectId: id })}
				{showDone}
				autofocus="desktop"
				placeholder="Add a task to {project.name}…"
			/>
		{/if}
	</div>
{:else}
	<p class="mt-20 text-center text-zinc-500">
		Project not found. <a href="/projects" class="text-indigo-600">All projects</a>
	</p>
{/if}
