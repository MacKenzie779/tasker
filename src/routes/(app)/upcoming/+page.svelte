<script lang="ts">
	import { ui } from '#lib/client/ui.svelte.ts';
	import { filters } from '#lib/client/views.svelte.ts';
	import { addDays, longDayLabel, relativeDayLabel } from '#lib/dates.ts';
	import Outliner from '#lib/components/Outliner.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import DayTabs from '#lib/components/DayTabs.svelte';

	ui.useCaptureContext(() => ({
		label: 'Tomorrow',
		defaults: { plannedDate: addDays(ui.today, 1) }
	}));

	const days = $derived(Array.from({ length: 14 }, (_, i) => addDays(ui.today, i + 1)));
</script>

<svelte:head><title>Upcoming · Tasker</title></svelte:head>

<div class="mx-auto max-w-3xl">
	<PageHeader title="Upcoming" subtitle="Next two weeks">
		{#snippet actions()}<DayTabs />{/snippet}
	</PageHeader>

	{#each days as day (day)}
		<section class="mb-5">
			<h2
				class="mb-0.5 flex items-baseline gap-2 border-b border-zinc-100 px-1 pb-1 text-sm font-semibold dark:border-zinc-800"
			>
				{relativeDayLabel(day, ui.today)}
				<span class="text-xs font-normal text-zinc-400">{longDayLabel(day)}</span>
			</h2>
			<Outliner
				filter={filters.day(day)}
				defaults={() => ({ plannedDate: day })}
				hideDate={day}
				showProject
				placeholder="Add…"
			/>
		</section>
	{/each}
</div>
