<!-- Every setting lives here, never in the capture line. Side panel on desktop, bottom sheet on mobile. -->
<script lang="ts">
	import { STATUSES, type Priority, type Task } from '#lib/types.ts';
	import { addDays, longDayLabel, startOfWeek } from '#lib/dates.ts';
	import { store } from '#lib/client/store.svelte.ts';
	import { ui } from '#lib/client/ui.svelte.ts';
	import { applyTokens, deleteWithUndo, openTask } from '#lib/client/actions.ts';
	import { autosize } from '#lib/client/autosize.ts';
	import Outliner from './Outliner.svelte';
	import Icon from './Icon.svelte';

	const task = $derived(ui.selectedId ? store.tasks[ui.selectedId] : undefined);
	const ancestors = $derived(task ? store.ancestors(task.id) : []);

	$effect(() => {
		if (ui.selectedId && !task) ui.selectedId = null;
	});

	const close = () => (ui.selectedId = null);
	const set = (patch: Partial<Task>) => task && store.updateTask(task.id, patch);

	const quickDates = $derived([
		{ label: 'Today', value: ui.today },
		{ label: 'Tomorrow', value: addDays(ui.today, 1) },
		{ label: 'Next week', value: addDays(startOfWeek(ui.today), 7) }
	]);

	const PRIORITIES: { value: Priority; label: string; cls: string }[] = [
		{ value: 0, label: 'None', cls: '' },
		{ value: 1, label: '!', cls: 'text-sky-600 dark:text-sky-400' },
		{ value: 2, label: '!!', cls: 'text-orange-500' },
		{ value: 3, label: '!!!', cls: 'text-red-600 dark:text-red-400' }
	];

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && task) {
			e.preventDefault();
			(document.activeElement as HTMLElement | null)?.blur();
			close();
		}
	}

	const segment = (active: boolean) => [
		'flex-1 rounded-md px-2 py-1 text-sm font-medium transition-colors',
		active
			? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
			: 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
	];
	const chip = (active: boolean) => [
		'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
		active
			? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
			: 'border-zinc-200 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300'
	];
	const input =
		'rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:[color-scheme:dark]';
</script>

<svelte:window onkeydown={onKeydown} />

{#if task}
	<button
		type="button"
		class="fixed inset-0 z-30 bg-black/20 lg:hidden"
		onclick={close}
		aria-label="Close details"
		tabindex="-1"
	></button>
	<aside
		class="fixed inset-x-0 bottom-0 z-40 flex max-h-[88dvh] flex-col rounded-t-2xl border-t border-zinc-200 bg-white shadow-2xl lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:w-[26rem] lg:rounded-none lg:border-t-0 lg:border-l dark:border-zinc-800 dark:bg-zinc-900"
		aria-label="Task details"
	>
		<div class="mx-auto mt-2 h-1 w-10 rounded-full bg-zinc-300 lg:hidden dark:bg-zinc-700"></div>
		<header class="flex items-center gap-2 px-4 pt-3 pb-1">
			<nav class="flex min-w-0 flex-1 items-center gap-1 truncate text-xs text-zinc-500">
				{#if task.projectId && store.projects[task.projectId]}
					{@const p = store.projects[task.projectId]}
					<a
						href="/projects/{p.id}"
						class="inline-flex items-center gap-1 hover:text-zinc-800 dark:hover:text-zinc-200"
						onclick={close}
					>
						<span class="size-2 rounded-full" style:background={p.color}></span>{p.name}
					</a>
				{:else}
					<a href="/inbox" class="hover:text-zinc-800 dark:hover:text-zinc-200" onclick={close}
						>Inbox</a
					>
				{/if}
				{#each ancestors as a (a.id)}
					<Icon name="chevron-right" class="size-3" />
					<button
						type="button"
						class="truncate hover:text-zinc-800 dark:hover:text-zinc-200"
						onclick={() => openTask(a.id)}
					>
						{a.title || 'Untitled'}
					</button>
				{/each}
			</nav>
			<button
				type="button"
				class="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
				onclick={() => deleteWithUndo(task.id)}
				aria-label="Delete task"
				title="Delete"
			>
				<Icon name="trash" />
			</button>
			<button
				type="button"
				class="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
				onclick={close}
				aria-label="Close"
				title="Close (Esc)"
			>
				<Icon name="x" />
			</button>
		</header>

		<div class="flex-1 space-y-5 overflow-y-auto px-4 pt-1 pb-6">
			<div class="flex items-start gap-2">
				<button
					type="button"
					class={[
						'mt-1.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2',
						task.status === 'done'
							? 'border-indigo-500 bg-indigo-500 text-white'
							: 'border-zinc-300 dark:border-zinc-600'
					]}
					onclick={() => store.toggleDone(task.id)}
					aria-label="Toggle done"
				>
					{#if task.status === 'done'}<Icon name="check" class="size-3" />{/if}
				</button>
				<textarea
					rows="1"
					value={task.title}
					use:autosize={task.title}
					oninput={(e) => set({ title: e.currentTarget.value.replace(/\n/g, ' ') })}
					onblur={() => applyTokens(task.id)}
					onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
					placeholder="Task"
					class={[
						'flex-1 resize-none overflow-hidden bg-transparent text-lg leading-7 font-semibold outline-none',
						task.status === 'done' && 'text-zinc-400 line-through'
					]}></textarea>
			</div>

			<section class="space-y-1.5">
				<h3 class="text-xs font-medium tracking-wide text-zinc-500 uppercase">Status</h3>
				<div class="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
					{#each STATUSES as s (s.id)}
						<button
							type="button"
							class={segment(task.status === s.id)}
							onclick={() => set({ status: s.id })}>{s.label}</button
						>
					{/each}
				</div>
			</section>

			<section class="space-y-1.5">
				<h3 class="text-xs font-medium tracking-wide text-zinc-500 uppercase">Priority</h3>
				<div class="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
					{#each PRIORITIES as p (p.value)}
						<button
							type="button"
							class={[segment(task.priority === p.value), p.cls]}
							onclick={() => set({ priority: p.value })}>{p.label}</button
						>
					{/each}
				</div>
			</section>

			{#if !task.parentId}
				<section class="space-y-1.5">
					<h3 class="text-xs font-medium tracking-wide text-zinc-500 uppercase">Project</h3>
					<select
						class={[input, 'w-full']}
						value={task.projectId ?? ''}
						onchange={(e) => set({ projectId: e.currentTarget.value || null })}
					>
						<option value="">Inbox</option>
						{#each store.projectList as p (p.id)}
							<option value={p.id}>{p.name}</option>
						{/each}
					</select>
				</section>
			{/if}

			<section class="space-y-1.5">
				<h3
					class="flex items-center gap-1 text-xs font-medium tracking-wide text-zinc-500 uppercase"
				>
					<Icon name="calendar" class="size-3" /> Planned
					{#if task.plannedDate}<span class="font-normal normal-case"
							>· {longDayLabel(task.plannedDate)}</span
						>{/if}
				</h3>
				<div class="flex flex-wrap items-center gap-1.5">
					{#each quickDates as q (q.label)}
						<button
							type="button"
							class={chip(task.plannedDate === q.value)}
							onclick={() => set({ plannedDate: q.value })}>{q.label}</button
						>
					{/each}
					<input
						type="date"
						class={input}
						value={task.plannedDate ?? ''}
						onchange={(e) => set({ plannedDate: e.currentTarget.value || null })}
						aria-label="Planned date"
					/>
					{#if task.plannedDate}
						<input
							type="time"
							class={input}
							value={task.plannedTime ?? ''}
							onchange={(e) => set({ plannedTime: e.currentTarget.value || null })}
							aria-label="Time"
						/>
						<button
							type="button"
							class="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
							onclick={() => set({ plannedDate: null })}>Clear</button
						>
					{/if}
				</div>
			</section>

			<section class="space-y-1.5">
				<h3
					class="flex items-center gap-1 text-xs font-medium tracking-wide text-zinc-500 uppercase"
				>
					<Icon name="flag" class="size-3" /> Deadline
					{#if task.deadline}<span class="font-normal normal-case"
							>· {longDayLabel(task.deadline)}</span
						>{/if}
				</h3>
				<div class="flex flex-wrap items-center gap-1.5">
					{#each quickDates as q (q.label)}
						<button
							type="button"
							class={chip(task.deadline === q.value)}
							onclick={() => set({ deadline: q.value })}>{q.label}</button
						>
					{/each}
					<input
						type="date"
						class={input}
						value={task.deadline ?? ''}
						onchange={(e) => set({ deadline: e.currentTarget.value || null })}
						aria-label="Deadline"
					/>
					{#if task.deadline}
						<button
							type="button"
							class="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
							onclick={() => set({ deadline: null })}>Clear</button
						>
					{/if}
				</div>
			</section>

			<section class="space-y-1.5">
				<h3 class="text-xs font-medium tracking-wide text-zinc-500 uppercase">Notes</h3>
				<textarea
					rows="3"
					value={task.notes}
					use:autosize={task.notes}
					oninput={(e) => set({ notes: e.currentTarget.value })}
					placeholder="Add notes…"
					class="w-full resize-none overflow-hidden rounded-md border border-zinc-200 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700"
				></textarea>
			</section>

			<section class="space-y-1">
				<h3 class="text-xs font-medium tracking-wide text-zinc-500 uppercase">Subtasks</h3>
				{#key task.id}
					<Outliner parentId={task.id} showDone placeholder="Add a subtask…" />
				{/key}
			</section>
		</div>
	</aside>
{/if}
