<script lang="ts">
	import { STATUSES, type Status, type Task } from '#lib/types.ts';
	import { keyBetween } from '#lib/order.ts';
	import { store } from '#lib/client/store.svelte.ts';
	import { applyTokens, openTask } from '#lib/client/actions.ts';
	import { draggable, type DropResult } from '#lib/client/drag.ts';
	import TaskMeta from './TaskMeta.svelte';
	import Icon from './Icon.svelte';

	let {
		match,
		defaults = () => ({}),
		showProject = false
	}: {
		/** which top-level tasks are on this board */
		match: (t: Task) => boolean;
		defaults?: () => Partial<Task>;
		showProject?: boolean;
	} = $props();

	const DONE_DAYS = 7;
	const boardKey = (t: Task) => t.boardKey ?? t.sortKey;

	const columns = $derived.by(() => {
		const doneSince = Date.now() - DONE_DAYS * 86_400_000;
		const cols: Record<Status, Task[]> = { todo: [], doing: [], done: [] };
		for (const t of Object.values(store.tasks)) {
			if (t.parentId || !match(t)) continue;
			if (t.status === 'done' && (t.completedAt ?? 0) < doneSince) continue;
			cols[t.status].push(t);
		}
		for (const s of ['todo', 'doing'] as const)
			cols[s].sort((a, b) => (boardKey(a) < boardKey(b) ? -1 : 1));
		cols.done.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
		return cols;
	});

	function onDrop(id: string, { zone, afterId, beforeId }: DropResult) {
		const status = zone as Status;
		const after = afterId ? store.tasks[afterId] : undefined;
		const before = beforeId ? store.tasks[beforeId] : undefined;
		store.updateTask(id, {
			status,
			boardKey: keyBetween(after && boardKey(after), before && boardKey(before))
		});
	}

	let drafts = $state<Record<Status, string>>({ todo: '', doing: '', done: '' });

	function add(status: Status) {
		const title = drafts[status].trim();
		if (!title) return;
		const last = columns[status].at(-1);
		const t = store.addTask({
			...defaults(),
			title,
			status,
			boardKey: keyBetween(last && boardKey(last), null)
		});
		drafts[status] = '';
		applyTokens(t.id);
	}
</script>

<div
	class="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:snap-none md:grid-cols-3 md:overflow-visible md:px-0"
	data-autoscroll
>
	{#each STATUSES as col (col.id)}
		<section
			class="flex w-[82vw] max-w-sm shrink-0 snap-center flex-col rounded-xl bg-zinc-100/80 p-2 md:w-auto md:max-w-none dark:bg-zinc-900"
			aria-label={col.label}
		>
			<h2
				class="flex items-center justify-between px-1.5 pt-0.5 pb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300"
			>
				{col.label}
				<span class="text-xs font-normal text-zinc-400">{columns[col.id].length}</span>
			</h2>
			<div
				class="flex min-h-16 flex-1 flex-col gap-2 rounded-lg transition-colors"
				data-drop={col.id}
			>
				{#each columns[col.id] as t (t.id)}
					<div
						class="cursor-grab touch-manipulation rounded-lg border border-zinc-200 bg-white p-2.5 text-sm shadow-xs select-none hover:border-zinc-300 active:cursor-grabbing dark:border-zinc-800 dark:bg-zinc-800/60 dark:hover:border-zinc-700"
						data-drag-item={t.id}
						use:draggable={{ id: t.id, onDrop: (r) => onDrop(t.id, r) }}
						onclick={() => openTask(t.id)}
						onkeydown={(e) => e.key === 'Enter' && openTask(t.id)}
						role="button"
						tabindex="0"
					>
						<div class="flex items-start gap-2">
							<button
								type="button"
								data-no-drag
								class={[
									'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2',
									t.status === 'done'
										? 'border-indigo-500 bg-indigo-500'
										: 'border-zinc-300 dark:border-zinc-600'
								]}
								onclick={(e) => (e.stopPropagation(), store.toggleDone(t.id))}
								aria-label="Toggle done"
							>
								{#if t.status === 'done'}<Icon name="check" class="size-2.5 text-white" />{/if}
							</button>
							<span
								class={[
									'line-clamp-3 flex-1 break-words',
									t.status === 'done' && 'text-zinc-400 line-through'
								]}
							>
								{t.title || 'Untitled'}
							</span>
						</div>
						<div class="mt-1.5 pl-6 empty:hidden"><TaskMeta task={t} {showProject} /></div>
					</div>
				{/each}
			</div>
			{#if col.id !== 'done'}
				<input
					class="mt-2 w-full rounded-md bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-800"
					placeholder="+ Add…"
					enterkeyhint="enter"
					bind:value={drafts[col.id]}
					onkeydown={(e) =>
						e.key === 'Enter' && !e.isComposing && (e.preventDefault(), add(col.id))}
					onblur={() => add(col.id)}
					aria-label="Add to {col.label}"
				/>
			{/if}
		</section>
	{/each}
</div>
