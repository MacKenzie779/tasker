<script lang="ts">
	import type { Task } from '#lib/types.ts';
	import { relativeDayLabel } from '#lib/dates.ts';
	import { store } from '#lib/client/store.svelte.ts';
	import { ui } from '#lib/client/ui.svelte.ts';
	import Icon from './Icon.svelte';

	let {
		task,
		showProject = false,
		hideDate = null,
		showProgress = true
	}: {
		task: Task;
		showProject?: boolean;
		/** don't repeat the planned date when the view is already that day */
		hideDate?: string | null;
		showProgress?: boolean;
	} = $props();

	const project = $derived(
		showProject && task.projectId ? store.projects[task.projectId] : undefined
	);
	const progress = $derived(showProgress ? store.progress(task.id) : { done: 0, total: 0 });
	const plannedLabel = $derived(
		task.plannedDate && task.plannedDate !== hideDate
			? relativeDayLabel(task.plannedDate, ui.today)
			: null
	);
	const open = $derived(task.status !== 'done');
	const plannedOverdue = $derived(open && !!task.plannedDate && task.plannedDate < ui.today);
	const deadlineSoon = $derived(open && !!task.deadline && task.deadline <= ui.today);
</script>

{#if task.priority || project || plannedLabel || task.plannedTime || task.deadline || progress.total || task.notes}
	<span
		class="flex shrink-0 flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400"
	>
		{#if task.priority}
			<span
				class={[
					'font-bold tracking-tighter',
					task.priority === 3 && 'text-red-600 dark:text-red-400',
					task.priority === 2 && 'text-orange-500',
					task.priority === 1 && 'text-sky-600 dark:text-sky-400'
				]}
				title="Priority">{'!'.repeat(task.priority)}</span
			>
		{/if}
		{#if plannedLabel || (task.plannedTime && task.plannedDate)}
			<span
				class={[
					'inline-flex items-center gap-0.5',
					plannedOverdue && 'text-red-600 dark:text-red-400'
				]}
			>
				<Icon name="calendar" class="size-3" />
				{[plannedLabel, task.plannedTime].filter(Boolean).join(' ')}
			</span>
		{/if}
		{#if task.deadline}
			<span
				class={[
					'inline-flex items-center gap-0.5',
					deadlineSoon
						? 'font-medium text-red-600 dark:text-red-400'
						: 'text-amber-700 dark:text-amber-400'
				]}
				title="Deadline"
			>
				<Icon name="flag" class="size-3" />
				{relativeDayLabel(task.deadline, ui.today)}
			</span>
		{/if}
		{#if progress.total}
			<span title="Subtasks done">{progress.done}/{progress.total}</span>
		{/if}
		{#if task.notes}
			<Icon name="notes" class="size-3" />
		{/if}
		{#if project}
			<span class="inline-flex items-center gap-1">
				<span class="size-2 rounded-full" style:background={project.color}></span>
				{project.name}
			</span>
		{/if}
	</span>
{/if}
