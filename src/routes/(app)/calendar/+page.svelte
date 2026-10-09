<script lang="ts">
	import type { Task } from '#lib/types.ts';
	import { store } from '#lib/client/store.svelte.ts';
	import { ui } from '#lib/client/ui.svelte.ts';
	import { openTask } from '#lib/client/actions.ts';
	import { draggable, type DropResult } from '#lib/client/drag.ts';
	import { filters } from '#lib/client/views.svelte.ts';
	import {
		addDays,
		addMonths,
		fromISODate,
		longDayLabel,
		monthGrid,
		monthLabel,
		relativeDayLabel,
		startOfWeek,
		WEEKDAY_NAMES
	} from '#lib/dates.ts';
	import Outliner from '#lib/components/Outliner.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Icon from '#lib/components/Icon.svelte';

	type Mode = 'month' | 'week';
	interface Item {
		key: string;
		task: Task;
		kind: 'plan' | 'due';
	}

	let mode = $state<Mode>('month');
	// svelte-ignore state_referenced_locally
	let cursor = $state(ui.today);
	// svelte-ignore state_referenced_locally
	let selected = $state(ui.today);
	let trayQuery = $state('');
	let trayOpen = $state(false);

	ui.useCaptureContext(() => ({
		label: relativeDayLabel(selected, ui.today),
		defaults: { plannedDate: selected }
	}));

	const days = $derived(
		mode === 'month'
			? monthGrid(cursor)
			: Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))
	);
	const currentMonth = $derived(cursor.slice(0, 7));

	const itemsByDay = $derived.by(() => {
		const map = new Map<string, Item[]>();
		const push = (day: string, item: Item) => {
			let list = map.get(day);
			if (!list) map.set(day, (list = []));
			list.push(item);
		};
		for (const t of Object.values(store.tasks)) {
			if (!store.isVisible(t)) continue;
			if (t.plannedDate) push(t.plannedDate, { key: `plan:${t.id}`, task: t, kind: 'plan' });
			if (t.deadline) push(t.deadline, { key: `due:${t.id}`, task: t, kind: 'due' });
		}
		for (const list of map.values()) {
			list.sort((a, b) => {
				if (a.kind !== b.kind) return a.kind === 'due' ? -1 : 1;
				const at = a.task.plannedTime ?? '99';
				const bt = b.task.plannedTime ?? '99';
				if (at !== bt) return at < bt ? -1 : 1;
				return b.task.priority - a.task.priority;
			});
		}
		return map;
	});

	const unscheduled = $derived.by(() => {
		const q = trayQuery.trim().toLowerCase();
		return Object.values(store.tasks)
			.filter(
				(t) => t.status !== 'done' && !t.plannedDate && (!q || t.title.toLowerCase().includes(q))
			)
			.sort(
				(a, b) =>
					b.priority - a.priority ||
					(a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') ||
					a.createdAt - b.createdAt
			)
			.slice(0, 200);
	});

	function onDrop(item: Pick<Item, 'task' | 'kind'>, { zone }: DropResult) {
		const date = zone === 'unscheduled' ? null : zone;
		if (item.kind === 'due') {
			if (date) store.updateTask(item.task.id, { deadline: date });
		} else {
			store.updateTask(item.task.id, { plannedDate: date });
		}
		if (date) selected = date;
	}

	function shift(dir: -1 | 1) {
		cursor = mode === 'month' ? addMonths(cursor, dir) : addDays(cursor, dir * 7);
	}

	function goToday() {
		cursor = ui.today;
		selected = ui.today;
	}

	const title = $derived(
		mode === 'month' ? monthLabel(cursor) : `${longDayLabel(days[0])} – ${longDayLabel(days[6])}`
	);
	const shortTitle = $derived(
		mode === 'month'
			? monthLabel(cursor).replace(/^(\w{3})\w*/, '$1')
			: longDayLabel(days[0]).replace(/^\w+ /, '') + ' –'
	);
	const iconBtn = 'rounded-lg p-1.5 sm:p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800';
</script>

<svelte:head><title>Calendar · Tasker</title></svelte:head>

{#snippet chip(item: Item, full: boolean)}
	{@const t = item.task}
	{@const p = t.projectId ? store.projects[t.projectId] : undefined}
	<div
		class={[
			'flex cursor-grab items-center gap-1 truncate rounded px-1.5 py-0.5 text-xs select-none',
			item.kind === 'due'
				? 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'
				: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700',
			t.status === 'done' && 'line-through opacity-50',
			full && 'py-1 text-sm'
		]}
		style:border-left="3px solid {p?.color ?? 'transparent'}"
		data-drag-item={item.key}
		use:draggable={{ id: item.key, onDrop: (r) => onDrop(item, r) }}
		onclick={(e) => (e.stopPropagation(), openTask(t.id))}
		onkeydown={(e) => e.key === 'Enter' && openTask(t.id)}
		role="button"
		tabindex="0"
		title={t.title}
	>
		{#if item.kind === 'due'}<Icon name="flag" class="size-3" />{/if}
		{#if t.plannedTime && item.kind === 'plan'}<span class="tabular-nums opacity-60"
				>{t.plannedTime}</span
			>{/if}
		<span class="truncate">{t.title || 'Untitled'}</span>
	</div>
{/snippet}

<div class="mx-auto max-w-7xl">
	<PageHeader>
		<h1 class="truncate text-xl font-bold tracking-tight lg:text-2xl">
			<span class="sm:hidden">{shortTitle}</span><span class="hidden sm:inline">{title}</span>
		</h1>
		{#snippet actions()}
			<div class="flex items-center">
				<button type="button" class={iconBtn} onclick={() => shift(-1)} aria-label="Previous"
					><Icon name="chevron-left" /></button
				>
				<button
					type="button"
					class="rounded-lg px-2 py-1 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
					onclick={goToday}>Today</button
				>
				<button type="button" class={iconBtn} onclick={() => shift(1)} aria-label="Next"
					><Icon name="chevron-right" /></button
				>
			</div>
			<div class="flex gap-1 rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-900">
				{#each ['month', 'week'] as const as m (m)}
					<button
						type="button"
						class={[
							'rounded-md px-2 py-0.5 font-medium capitalize sm:px-2.5',
							mode === m ? 'bg-white shadow-sm dark:bg-zinc-700' : 'text-zinc-500'
						]}
						onclick={() => (mode = m)}>{m}</button
					>
				{/each}
			</div>
		{/snippet}
	</PageHeader>

	<div class="flex flex-col gap-6 lg:flex-row">
		<div class="min-w-0 flex-1">
			{#if mode === 'month'}
				<div class="grid grid-cols-7 text-center text-xs font-medium text-zinc-400">
					{#each WEEKDAY_NAMES as d (d)}<div class="pb-1">{d}</div>{/each}
				</div>
				<div
					class="grid grid-cols-7 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
				>
					{#each days as day (day)}
						{@const items = itemsByDay.get(day) ?? []}
						<div
							class={[
								'relative min-h-14 border-zinc-200 p-1 text-left transition-colors md:min-h-28 dark:border-zinc-800',
								'[&:not(:nth-child(7n))]:border-r [&:nth-child(n+8)]:border-t',
								day.slice(0, 7) !== currentMonth &&
									'bg-zinc-50/70 text-zinc-400 dark:bg-zinc-900/40',
								selected === day && 'bg-indigo-50/70 dark:bg-indigo-500/10'
							]}
							data-drop={day}
							data-drop-indicator="none"
							onclick={() => (selected = day)}
							onkeydown={(e) => e.key === 'Enter' && (selected = day)}
							role="gridcell"
							tabindex="-1"
						>
							<div class="mb-0.5 flex justify-center md:justify-start">
								<span
									class={[
										'flex size-6 items-center justify-center rounded-full text-xs',
										day === ui.today && 'bg-indigo-600 font-semibold text-white'
									]}>{fromISODate(day).getDate()}</span
								>
							</div>
							<div class="hidden space-y-0.5 md:block">
								{#each items.slice(0, 4) as item (item.key)}
									{@render chip(item, false)}
								{/each}
								{#if items.length > 4}<div class="px-1 text-xs text-zinc-400">
										+{items.length - 4} more
									</div>{/if}
							</div>
							<div class="flex flex-wrap justify-center gap-0.5 md:hidden">
								{#each items.slice(0, 4) as item (item.key)}
									<span
										class={[
											'size-1.5 rounded-full',
											item.kind === 'due' ? 'bg-red-500' : 'bg-indigo-400'
										]}
									></span>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-2 md:grid-cols-7">
					{#each days as day (day)}
						{@const items = itemsByDay.get(day) ?? []}
						<div
							class={[
								'flex min-h-20 flex-col gap-1 rounded-xl border p-2 md:min-h-[60vh]',
								selected === day
									? 'border-indigo-300 dark:border-indigo-500/50'
									: 'border-zinc-200 dark:border-zinc-800'
							]}
							data-drop={day}
							data-drop-indicator="none"
							onclick={() => (selected = day)}
							onkeydown={(e) => e.key === 'Enter' && (selected = day)}
							role="gridcell"
							tabindex="-1"
						>
							<div
								class={[
									'mb-1 text-xs font-medium',
									day === ui.today ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500'
								]}
							>
								{longDayLabel(day)}
							</div>
							{#each items as item (item.key)}
								{@render chip(item, true)}
							{/each}
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<aside class="w-full shrink-0 space-y-6 lg:w-80">
			<section>
				<h2 class="mb-1 px-1 text-sm font-semibold">
					{relativeDayLabel(selected, ui.today)}
					<span class="text-xs font-normal text-zinc-400">{longDayLabel(selected)}</span>
				</h2>
				{#key selected}
					<Outliner
						filter={filters.day(selected)}
						defaults={() => ({ plannedDate: selected })}
						hideDate={selected}
						showProject
						placeholder="Add to this day…"
					/>
				{/key}
			</section>

			<section>
				<button
					type="button"
					class="mb-1 flex w-full items-center justify-between px-1 text-sm font-semibold lg:pointer-events-none"
					onclick={() => (trayOpen = !trayOpen)}
				>
					Unscheduled <span class="text-xs font-normal text-zinc-400"
						>{unscheduled.length} · drag onto a day</span
					>
				</button>
				<div class={['space-y-2', !trayOpen && 'hidden lg:block']}>
					<input
						bind:value={trayQuery}
						placeholder="Filter…"
						class="w-full rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700"
					/>
					<div
						class="max-h-[50vh] space-y-1 overflow-y-auto rounded-lg p-0.5"
						data-drop="unscheduled"
						data-drop-indicator="none"
					>
						{#each unscheduled as t (t.id)}
							{@render chip({ key: `plan:${t.id}`, task: t, kind: 'plan' }, true)}
						{/each}
					</div>
				</div>
			</section>
		</aside>
	</div>
</div>
