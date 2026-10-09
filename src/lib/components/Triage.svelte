<!-- Inbox "process" mode: go through captured tasks one by one with single keys. Optional, never required. -->
<script lang="ts">
	import type { Priority, Task } from '#lib/types.ts';
	import { addDays, startOfWeek } from '#lib/dates.ts';
	import { store } from '#lib/client/store.svelte.ts';
	import { ui } from '#lib/client/ui.svelte.ts';
	import { deleteWithUndo } from '#lib/client/actions.ts';
	import TaskMeta from './TaskMeta.svelte';
	import Icon from './Icon.svelte';

	let ids = $state<string[]>([]);
	let index = $state(0);
	let mode = $state<'main' | 'project'>('main');
	let dateInput = $state<HTMLInputElement>();
	let deadlineInput = $state<HTMLInputElement>();

	$effect(() => {
		if (ui.triageOpen) {
			ids = Object.values(store.tasks)
				.filter((t) => !t.projectId && !t.parentId && t.status !== 'done')
				.sort((a, b) => (a.sortKey < b.sortKey ? -1 : 1))
				.map((t) => t.id);
			index = 0;
			mode = 'main';
		}
	});

	const task = $derived<Task | undefined>(store.tasks[ids[index]]);
	const finished = $derived(ui.triageOpen && index >= ids.length);

	const set = (patch: Partial<Task>) => task && store.updateTask(task.id, patch);
	const next = () => {
		mode = 'main';
		index = Math.min(index + 1, ids.length);
	};
	const prev = () => (index = Math.max(0, index - 1));
	const close = () => (ui.triageOpen = false);

	const plan = (days: 'today' | 'tomorrow' | 'week') =>
		set({
			plannedDate:
				days === 'today'
					? ui.today
					: days === 'tomorrow'
						? addDays(ui.today, 1)
						: addDays(startOfWeek(ui.today), 7)
		});

	function pickProject(i: number) {
		const p = store.projectList[i];
		if (p) set({ projectId: p.id });
		mode = 'main';
	}

	function onKeydown(e: KeyboardEvent) {
		if (!ui.triageOpen) return;
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT') {
			if (e.key === 'Escape' || e.key === 'Enter') target.blur();
			return;
		}
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		const k = e.key;
		if (k === 'Escape') {
			if (mode === 'project') mode = 'main';
			else close();
		} else if (finished) {
			if (k === 'Enter') close();
			return;
		} else if (mode === 'project') {
			if (/^[1-9]$/.test(k)) pickProject(Number(k) - 1);
			else if (k === '0') {
				set({ projectId: null });
				mode = 'main';
			}
		} else if (/^[0-3]$/.test(k)) set({ priority: Number(k) as Priority });
		else if (k === 'p') mode = 'project';
		else if (k === 't') plan('today');
		else if (k === 'm') plan('tomorrow');
		else if (k === 'w') plan('week');
		else if (k === 'd') dateInput?.showPicker?.() ?? dateInput?.focus();
		else if (k === 'D') deadlineInput?.showPicker?.() ?? deadlineInput?.focus();
		else if (k === 'x' && task) store.toggleDone(task.id);
		else if ((k === 'Delete' || k === 'Backspace') && task) {
			deleteWithUndo(task.id);
			next();
		} else if (k === 'Enter' || k === 'ArrowRight' || k === 'j') next();
		else if (k === 'ArrowLeft' || k === 'k') prev();
		else return;
		e.preventDefault();
	}

	const btn =
		'inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800';
	const kbd = 'rounded bg-zinc-100 px-1 font-mono text-[11px] text-zinc-500 dark:bg-zinc-800';
</script>

<svelte:window onkeydown={onKeydown} />

{#if ui.triageOpen}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-4"
		role="presentation"
	>
		<div
			class="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl dark:bg-zinc-900"
			role="dialog"
			aria-label="Process inbox"
		>
			<div class="mb-4 flex items-center justify-between text-xs text-zinc-500">
				<span>Process inbox · {Math.min(index + 1, ids.length)} / {ids.length}</span>
				<button
					type="button"
					class="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
					onclick={close}
					aria-label="Close"><Icon name="x" /></button
				>
			</div>

			{#if finished || !ids.length}
				<p class="py-8 text-center text-zinc-600 dark:text-zinc-300">Inbox processed. Nice.</p>
				<button
					type="button"
					class="w-full rounded-lg bg-indigo-600 py-2 font-medium text-white"
					onclick={close}>Close</button
				>
			{:else if task}
				<input
					class="w-full bg-transparent text-xl font-semibold outline-none"
					value={task.title}
					oninput={(e) => set({ title: e.currentTarget.value })}
					aria-label="Title"
				/>
				<div class="mt-2 min-h-5"><TaskMeta {task} showProject /></div>

				{#if mode === 'project'}
					<div class="mt-4 grid grid-cols-2 gap-1.5">
						<button
							type="button"
							class={btn}
							onclick={() => (set({ projectId: null }), (mode = 'main'))}
							><span class={kbd}>0</span>Inbox</button
						>
						{#each store.projectList.slice(0, 9) as p, i (p.id)}
							<button type="button" class={btn} onclick={() => pickProject(i)}>
								<span class={kbd}>{i + 1}</span><span
									class="size-2 rounded-full"
									style:background={p.color}
								></span>
								<span class="truncate">{p.name}</span>
							</button>
						{/each}
					</div>
				{:else}
					<div class="mt-4 flex flex-wrap gap-1.5">
						<button type="button" class={btn} onclick={() => (mode = 'project')}
							><span class={kbd}>p</span>Project</button
						>
						<button type="button" class={btn} onclick={() => plan('today')}
							><span class={kbd}>t</span>Today</button
						>
						<button type="button" class={btn} onclick={() => plan('tomorrow')}
							><span class={kbd}>m</span>Tomorrow</button
						>
						<button type="button" class={btn} onclick={() => plan('week')}
							><span class={kbd}>w</span>Next week</button
						>
						<label class={btn}>
							<span class={kbd}>d</span>Date
							<input
								bind:this={dateInput}
								type="date"
								class="w-0 opacity-0"
								value={task.plannedDate ?? ''}
								onchange={(e) => set({ plannedDate: e.currentTarget.value || null })}
							/>
						</label>
						<label class={btn}>
							<span class={kbd}>D</span>Deadline
							<input
								bind:this={deadlineInput}
								type="date"
								class="w-0 opacity-0"
								value={task.deadline ?? ''}
								onchange={(e) => set({ deadline: e.currentTarget.value || null })}
							/>
						</label>
						{#each [1, 2, 3] as const as p (p)}
							<button
								type="button"
								class={[btn, task.priority === p && 'border-indigo-500']}
								onclick={() => set({ priority: task.priority === p ? 0 : p })}
							>
								<span class={kbd}>{p}</span>{'!'.repeat(p)}
							</button>
						{/each}
						<button type="button" class={btn} onclick={() => store.toggleDone(task.id)}
							><span class={kbd}>x</span>Done</button
						>
						<button type="button" class={btn} onclick={() => (deleteWithUndo(task.id), next())}
							><span class={kbd}>Del</span>Delete</button
						>
					</div>
				{/if}

				<div class="mt-5 flex justify-between">
					<button
						type="button"
						class="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800"
						onclick={prev}
						disabled={index === 0}
					>
						← Back
					</button>
					<button
						type="button"
						class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
						onclick={next}
					>
						Next <span class="opacity-60">↵</span>
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
