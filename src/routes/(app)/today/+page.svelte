<script lang="ts">
	import { store } from '#lib/client/store.svelte.ts';
	import { ui } from '#lib/client/ui.svelte.ts';
	import { filters } from '#lib/client/views.svelte.ts';
	import { longDayLabel } from '#lib/dates.ts';
	import Outliner from '#lib/components/Outliner.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import DayTabs from '#lib/components/DayTabs.svelte';

	ui.useCaptureContext(() => ({ label: 'Today', defaults: { plannedDate: ui.today } }));

	const overdue = $derived(Object.values(store.tasks).filter(filters.overdue(ui.today)));

	function moveOverdueToToday() {
		for (const t of overdue) {
			if (t.plannedDate && t.plannedDate < ui.today)
				store.updateTask(t.id, { plannedDate: ui.today });
		}
	}
</script>

<svelte:head><title>Today · Tasker</title></svelte:head>

<div class="mx-auto max-w-3xl">
	<PageHeader title="Today" subtitle={longDayLabel(ui.today)}>
		{#snippet actions()}<DayTabs />{/snippet}
	</PageHeader>

	{#if overdue.length}
		<section class="mb-6">
			<h2
				class="mb-1 flex items-center justify-between px-1 text-sm font-semibold text-red-600 dark:text-red-400"
			>
				Overdue
				{#if overdue.some((t) => t.plannedDate && t.plannedDate < ui.today)}
					<button
						type="button"
						class="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
						onclick={moveOverdueToToday}
					>
						Move to today
					</button>
				{/if}
			</h2>
			<Outliner filter={filters.overdue(ui.today)} capture={false} showProject />
		</section>
	{/if}

	<Outliner
		filter={filters.day(ui.today)}
		defaults={() => ({ plannedDate: ui.today })}
		hideDate={ui.today}
		showProject
		autofocus="desktop"
		placeholder="Add a task for today…"
	>
		{#snippet empty()}
			<p class="mt-6 px-7 text-sm text-zinc-400">Nothing planned for today.</p>
		{/snippet}
	</Outliner>
</div>
