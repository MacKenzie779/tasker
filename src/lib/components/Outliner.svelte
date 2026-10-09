<!--
	The capture surface. Behaves like a bullet list:
	  Enter → next line · Tab / Shift+Tab → indent / outdent · Backspace on empty line → remove it
	  paste a multi-line list → tree
	Nothing to fill in: the view supplies defaults (project, date, …), optional tokens are applied on Enter.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { Task } from '#lib/types.ts';
	import { keyBetween } from '#lib/order.ts';
	import { parseOutline, type OutlineNode } from '#lib/paste.ts';
	import { store } from '#lib/client/store.svelte.ts';
	import { ui } from '#lib/client/ui.svelte.ts';
	import { applyTokens, openTask } from '#lib/client/actions.ts';
	import { autosize, isTouch } from '#lib/client/autosize.ts';
	import TaskMeta from './TaskMeta.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		/** which tasks are top-level rows here (ignored when parentId is set) */
		filter?: (t: Task) => boolean;
		/** fields new top-level tasks get in this view */
		defaults?: () => Partial<Task>;
		/** outline the subtasks of this task instead of a filtered view */
		parentId?: string | null;
		showProject?: boolean;
		hideDate?: string | null;
		showDone?: boolean;
		capture?: boolean;
		placeholder?: string;
		/** 'desktop' = only where it won't pop up a phone keyboard on page load */
		autofocus?: boolean | 'desktop';
		onCreated?: (task: Task) => void;
		empty?: import('svelte').Snippet;
	}

	let {
		filter = () => false,
		defaults = () => ({}),
		parentId = null,
		showProject = false,
		hideDate = null,
		showDone = false,
		capture = true,
		placeholder = 'Add a task…',
		autofocus = false,
		onCreated,
		empty
	}: Props = $props();

	interface Row {
		task: Task;
		depth: number;
		hasChildren: boolean;
	}

	let container: HTMLDivElement;
	let ghostEl = $state<HTMLTextAreaElement>();
	let ghostText = $state('');
	let ghostDepth = $state(0);
	let focusedId = $state<string | null>(null);
	/** rows outdented to the top level stay visible here even if they no longer match the filter */
	const sticky = new SvelteSet<string>();

	const bySortKey = (a: Task, b: Task) =>
		a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0;

	const roots = $derived.by(() => {
		if (parentId) return store.children(parentId).filter((t) => store.isVisible(t, showDone));
		const candidates = Object.values(store.tasks).filter(
			(t) => store.isVisible(t, showDone) && (sticky.has(t.id) || filter(t))
		);
		const ids = new Set(candidates.map((t) => t.id));
		// a task already shown under a matching ancestor isn't repeated at the top level
		return candidates
			.filter((t) => {
				let p = t.parentId;
				while (p) {
					if (ids.has(p)) return false;
					p = store.tasks[p]?.parentId ?? null;
				}
				return true;
			})
			.sort(bySortKey);
	});

	const rows = $derived.by(() => {
		const out: Row[] = [];
		const walk = (t: Task, depth: number) => {
			const kids = store.children(t.id).filter((c) => store.isVisible(c, showDone));
			out.push({ task: t, depth, hasChildren: kids.length > 0 });
			if (kids.length && !store.collapsed.has(t.id)) for (const k of kids) walk(k, depth + 1);
		};
		for (const r of roots) walk(r, 0);
		return out;
	});

	const maxGhostDepth = $derived(rows.length ? rows[rows.length - 1].depth + 1 : 0);
	const effectiveGhostDepth = $derived(Math.min(ghostDepth, maxGhostDepth));

	onMount(() => {
		if (autofocus === true || (autofocus === 'desktop' && !isTouch())) ghostEl?.focus();
	});

	export function focusGhost() {
		ghostEl?.focus();
	}

	// --- helpers ---------------------------------------------------------------

	const inputOf = (id: string) =>
		container?.querySelector<HTMLTextAreaElement>(`textarea[data-id="${id}"]`);

	async function focusRow(id: string, caret: 'start' | 'end' | number = 'end') {
		await tick();
		const ta = inputOf(id);
		if (!ta) return;
		ta.focus();
		const pos = caret === 'start' ? 0 : caret === 'end' ? ta.value.length : caret;
		ta.setSelectionRange(pos, pos);
	}

	function nextRoot(t: Task): Task | undefined {
		return roots[roots.findIndex((r) => r.id === t.id) + 1];
	}

	function nextSibling(t: Task): Task | undefined {
		const siblings = store.children(t.parentId);
		return siblings[siblings.findIndex((s) => s.id === t.id) + 1];
	}

	function createTopLevel(
		title: string,
		after: Task | null | undefined,
		before: Task | null | undefined,
		extra: Partial<Task> = {}
	) {
		const parent = parentId ? store.tasks[parentId] : undefined;
		const task = store.addTask({
			title,
			parentId: parentId ?? null,
			...(parent ? { projectId: parent.projectId } : defaults()),
			...extra,
			sortKey: keyBetween(after?.sortKey, before?.sortKey)
		});
		onCreated?.(task);
		return task;
	}

	function createChild(
		parent: Task,
		title: string,
		after: Task | null | undefined,
		before: Task | null | undefined,
		extra: Partial<Task> = {}
	) {
		store.setCollapsed(parent.id, false);
		return store.addTask({
			title,
			parentId: parent.id,
			projectId: parent.projectId,
			...extra,
			sortKey: keyBetween(after?.sortKey, before?.sortKey)
		});
	}

	/** The task the ghost line would become a child of, at its current indent. */
	function ghostParent(): Task | null {
		const d = effectiveGhostDepth;
		if (d === 0) return null;
		for (let i = rows.length - 1; i >= 0; i--) if (rows[i].depth === d - 1) return rows[i].task;
		return null;
	}

	function createAtGhost(title: string, extra: Partial<Task> = {}): Task {
		const parent = ghostParent();
		if (parent) return createChild(parent, title, store.children(parent.id).at(-1), null, extra);
		return createTopLevel(title, roots.at(-1), null, extra);
	}

	function insertSubtree(parent: Task, nodes: OutlineNode[], created: Task[]) {
		for (const node of nodes) {
			const t = createChild(
				parent,
				node.text,
				store.children(parent.id).at(-1),
				null,
				node.done ? { status: 'done' } : {}
			);
			created.push(t);
			insertSubtree(t, node.children, created);
		}
	}

	// --- ghost line (always-there capture line at the bottom) -------------------

	function commitGhost(): Task | undefined {
		const text = ghostText.replace(/\n/g, ' ').trim();
		if (!text) return;
		const t = createAtGhost(text);
		ghostText = '';
		applyTokens(t.id);
		return t;
	}

	function onGhostKeydown(e: KeyboardEvent) {
		if (e.isComposing) return;
		if (e.key === 'Enter') {
			e.preventDefault();
			if (!ghostText.trim() && effectiveGhostDepth > 0) ghostDepth = effectiveGhostDepth - 1;
			else {
				const t = commitGhost();
				if (t && e.shiftKey) openTask(t.id);
			}
		} else if (e.key === 'Tab') {
			e.preventDefault();
			ghostIndent(e.shiftKey ? -1 : 1);
		} else if (e.key === 'Backspace' && !ghostText && effectiveGhostDepth > 0) {
			e.preventDefault();
			ghostDepth = effectiveGhostDepth - 1;
		} else if (e.key === 'ArrowUp' && !ghostText && rows.length) {
			e.preventDefault();
			focusRow(rows[rows.length - 1].task.id);
		} else if (e.key === 'Escape') {
			ghostEl?.blur();
		}
	}

	function ghostIndent(dir: -1 | 1) {
		ghostDepth = Math.max(0, Math.min(maxGhostDepth, effectiveGhostDepth + dir));
	}

	function onGhostPaste(e: ClipboardEvent) {
		const text = e.clipboardData?.getData('text/plain');
		if (!text || !text.includes('\n')) return;
		e.preventDefault();
		const nodes = parseOutline((ghostText ? ghostText + ' ' : '') + text);
		const created: Task[] = [];
		for (const node of nodes) {
			const t = createAtGhost(node.text, node.done ? { status: 'done' } : {});
			created.push(t);
			insertSubtree(t, node.children, created);
		}
		ghostText = '';
		for (const t of created) applyTokens(t.id);
		if (created.length > 1) ui.toast(`Added ${created.length} tasks`);
	}

	// --- rows --------------------------------------------------------------------

	function onRowInput(t: Task, e: Event) {
		const value = (e.currentTarget as HTMLTextAreaElement).value.replace(/\n/g, ' ');
		store.updateTask(t.id, { title: value });
	}

	function onRowBlur(t: Task) {
		applyTokens(t.id);
		setTimeout(() => {
			if (focusedId === t.id) focusedId = null;
			const cur = store.tasks[t.id];
			if (
				cur &&
				!cur.title.trim() &&
				!store.children(cur.id).length &&
				document.activeElement !== inputOf(cur.id)
			) {
				store.deleteTask(cur.id);
			}
		}, 150);
	}

	function enterOnRow(index: number, ta: HTMLTextAreaElement) {
		const row = rows[index];
		const t = row.task;
		if (!t.title.trim()) {
			if (row.depth > 0) outdentRow(index);
			else if (capture) ghostEl?.focus();
			return;
		}
		const pos = ta.selectionStart;
		const rest = t.title.slice(ta.selectionEnd).trim();
		if (rest || pos < t.title.length)
			store.updateTask(t.id, { title: t.title.slice(0, pos).trimEnd() });
		applyTokens(t.id);

		let created: Task;
		if (!rest && row.hasChildren && !store.collapsed.has(t.id)) {
			created = createChild(t, '', null, store.children(t.id)[0]);
		} else if (row.depth === 0) {
			created = createTopLevel(rest, t, nextRoot(t));
		} else {
			const parent = store.tasks[t.parentId!];
			created = createChild(parent, rest, t, nextSibling(t));
		}
		focusRow(created.id, 'start');
	}

	function indentRow(index: number) {
		const row = rows[index];
		let prev: Task | undefined;
		for (let i = index - 1; i >= 0; i--) {
			if (rows[i].depth < row.depth) return;
			if (rows[i].depth === row.depth) {
				prev = rows[i].task;
				break;
			}
		}
		if (!prev) return;
		const caret = inputOf(row.task.id)?.selectionStart ?? 'end';
		store.moveInto(row.task.id, prev.id);
		focusRow(row.task.id, caret);
	}

	function outdentRow(index: number) {
		const row = rows[index];
		if (row.depth === 0) return;
		const caret = inputOf(row.task.id)?.selectionStart ?? 'end';
		if (row.depth === 1) sticky.add(row.task.id);
		store.outdent(row.task.id);
		focusRow(row.task.id, caret);
	}

	function moveRow(index: number, dir: -1 | 1) {
		const row = rows[index];
		const t = row.task;
		if (row.depth === 0 && !parentId) {
			const i = roots.findIndex((r) => r.id === t.id);
			const target = roots[i + dir];
			if (!target) return;
			const beyond = roots[i + dir * 2];
			store.updateTask(t.id, {
				sortKey:
					dir < 0
						? keyBetween(beyond?.sortKey, target.sortKey)
						: keyBetween(target.sortKey, beyond?.sortKey)
			});
		} else {
			store.moveSibling(t.id, dir);
		}
		focusRow(t.id);
	}

	function removeRow(index: number) {
		const row = rows[index];
		const prev = rows[index - 1];
		store.deleteTask(row.task.id);
		if (prev) focusRow(prev.task.id, 'end');
		else ghostEl?.focus();
	}

	function onRowKeydown(e: KeyboardEvent, index: number) {
		if (e.isComposing) return;
		const ta = e.currentTarget as HTMLTextAreaElement;
		const row = rows[index];
		const mod = e.ctrlKey || e.metaKey;
		if (e.key === 'Enter') {
			e.preventDefault();
			if (mod) store.toggleDone(row.task.id);
			else if (e.shiftKey) {
				applyTokens(row.task.id);
				openTask(row.task.id);
			} else enterOnRow(index, ta);
		} else if (e.key === 'Tab') {
			e.preventDefault();
			if (e.shiftKey) outdentRow(index);
			else indentRow(index);
		} else if (e.key === 'Backspace' && !ta.value && !row.hasChildren) {
			e.preventDefault();
			removeRow(index);
		} else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.altKey) {
			e.preventDefault();
			moveRow(index, e.key === 'ArrowUp' ? -1 : 1);
		} else if (e.key === 'ArrowUp' && !e.shiftKey && !mod) {
			const prev = rows[index - 1];
			if (prev) {
				e.preventDefault();
				focusRow(prev.task.id, Math.min(ta.selectionStart, prev.task.title.length));
			}
		} else if (e.key === 'ArrowDown' && !e.shiftKey && !mod) {
			e.preventDefault();
			const next = rows[index + 1];
			if (next) focusRow(next.task.id, Math.min(ta.selectionStart, next.task.title.length));
			else ghostEl?.focus();
		} else if (e.key === 'Escape') {
			ta.blur();
		}
	}

	function onRowPaste(e: ClipboardEvent, index: number) {
		const text = e.clipboardData?.getData('text/plain');
		if (!text || !text.includes('\n')) return;
		e.preventDefault();
		const row = rows[index];
		const nodes = parseOutline(text);
		if (!nodes.length) return;
		const created: Task[] = [];
		let first = 0;
		if (!row.task.title.trim()) {
			store.updateTask(row.task.id, { title: nodes[0].text });
			insertSubtree(row.task, nodes[0].children, created);
			created.push(row.task);
			first = 1;
		}
		let after = row.task;
		const before = row.depth === 0 ? nextRoot(row.task) : nextSibling(row.task);
		const parent = row.depth === 0 ? null : store.tasks[row.task.parentId!];
		for (const node of nodes.slice(first)) {
			const extra: Partial<Task> = node.done ? { status: 'done' } : {};
			const t = parent
				? createChild(parent, node.text, after, before, extra)
				: createTopLevel(node.text, after, before, extra);
			created.push(t);
			insertSubtree(t, node.children, created);
			after = t;
		}
		for (const t of created) applyTokens(t.id);
		if (created.length > 1) ui.toast(`Added ${created.length} tasks`);
	}

	// --- mobile toolbar (no Tab key on phones) ------------------------------------

	const focusedIndex = $derived(focusedId ? rows.findIndex((r) => r.task.id === focusedId) : -1);
	let touch = $state(false);
	$effect(() => {
		touch = isTouch();
	});

	function toolbar(action: 'indent' | 'outdent' | 'up' | 'down' | 'details' | 'done' | 'close') {
		if (focusedId === 'ghost') {
			if (action === 'indent') ghostIndent(1);
			if (action === 'outdent') ghostIndent(-1);
			if (action === 'close') ghostEl?.blur();
			return;
		}
		const i = focusedIndex;
		if (i < 0) return;
		const id = rows[i].task.id;
		if (action === 'indent') indentRow(i);
		else if (action === 'outdent') outdentRow(i);
		else if (action === 'up') moveRow(i, -1);
		else if (action === 'down') moveRow(i, 1);
		else if (action === 'done') store.toggleDone(id);
		else if (action === 'details') {
			inputOf(id)?.blur();
			openTask(id);
		} else if (action === 'close') inputOf(id)?.blur();
	}
</script>

<div bind:this={container} class="outliner">
	{#each rows as row, index (row.task.id)}
		{@const t = row.task}
		{@const done = t.status === 'done'}
		<div
			class="group flex items-start gap-1 rounded-md py-0.5 pr-1 transition-colors hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50"
			style:padding-left="{row.depth * 1.5}rem"
			data-row={t.id}
		>
			<button
				type="button"
				tabindex="-1"
				class={[
					'mt-1 flex size-5 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200',
					!row.hasChildren && 'invisible'
				]}
				onclick={() => store.setCollapsed(t.id, !store.collapsed.has(t.id))}
				aria-label={store.collapsed.has(t.id) ? 'Expand' : 'Collapse'}
			>
				<Icon
					name={store.collapsed.has(t.id) ? 'chevron-right' : 'chevron-down'}
					class="size-3.5"
				/>
			</button>
			<button
				type="button"
				tabindex="-1"
				class={[
					'mt-[5px] flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors',
					done
						? 'border-indigo-500 bg-indigo-500 text-white'
						: t.priority === 3
							? 'border-red-500 hover:bg-red-500/10'
							: t.priority === 2
								? 'border-orange-400 hover:bg-orange-400/10'
								: t.priority === 1
									? 'border-sky-500 hover:bg-sky-500/10'
									: 'border-zinc-300 hover:border-zinc-500 dark:border-zinc-600',
					t.status === 'doing' &&
						!done &&
						'bg-[conic-gradient(currentColor_0_50%,transparent_50%_100%)] text-indigo-400/60'
				]}
				onclick={() => store.toggleDone(t.id)}
				aria-label={done ? 'Mark as not done' : 'Mark as done'}
			>
				{#if done}<Icon name="check" class="size-3" />{/if}
			</button>
			<div class="flex min-w-0 flex-1 flex-wrap items-start gap-x-2">
				<textarea
					rows="1"
					data-id={t.id}
					value={t.title}
					use:autosize={t.title}
					oninput={(e) => onRowInput(t, e)}
					onkeydown={(e) => onRowKeydown(e, index)}
					onpaste={(e) => onRowPaste(e, index)}
					onfocus={() => (focusedId = t.id)}
					onblur={() => onRowBlur(t)}
					class={[
						'min-w-[10rem] flex-1 resize-none overflow-hidden bg-transparent py-0.5 leading-6 outline-none',
						done && 'text-zinc-400 line-through dark:text-zinc-500'
					]}
					aria-label="Task"></textarea>
				<button
					type="button"
					tabindex="-1"
					class="mt-1.5 cursor-pointer"
					onclick={() => openTask(t.id)}
				>
					<TaskMeta
						task={t}
						showProject={showProject && row.depth === 0}
						{hideDate}
						showProgress={store.collapsed.has(t.id)}
					/>
				</button>
			</div>
			<button
				type="button"
				tabindex="-1"
				class="mt-1 rounded p-0.5 text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-zinc-200 hover:text-zinc-700 focus:opacity-100 dark:hover:bg-zinc-700 dark:hover:text-zinc-200 pointer-coarse:opacity-60"
				onclick={() => openTask(t.id)}
				aria-label="Open details"
				title="Details (Shift+Enter)"
			>
				<Icon name="chevron-right" />
			</button>
		</div>
	{/each}

	{#if capture}
		<div
			class="flex items-start gap-1 py-0.5 pr-1"
			style:padding-left="{effectiveGhostDepth * 1.5}rem"
		>
			<span class="mt-1 size-5"></span>
			<span
				class="mt-[5px] size-[18px] shrink-0 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-600"
			></span>
			<textarea
				rows="1"
				bind:this={ghostEl}
				bind:value={ghostText}
				use:autosize={ghostText}
				onkeydown={onGhostKeydown}
				onpaste={onGhostPaste}
				onfocus={() => (focusedId = 'ghost')}
				onblur={() => {
					commitGhost();
					setTimeout(() => focusedId === 'ghost' && (focusedId = null), 150);
				}}
				{placeholder}
				enterkeyhint="enter"
				class="min-w-0 flex-1 resize-none overflow-hidden bg-transparent py-0.5 leading-6 outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
				aria-label="New task"
				data-ghost></textarea>
		</div>
	{/if}

	{#if !rows.length && empty}
		{@render empty()}
	{/if}
</div>

{#if touch && focusedId}
	<div
		class="fixed inset-x-0 z-50 flex items-center justify-around border-t border-zinc-200 bg-white/95 px-2 py-1 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95"
		style:bottom="{ui.keyboardInset}px"
		role="toolbar"
		aria-label="Outline tools"
	>
		{#each [['outdent', 'outdent'], ['indent', 'indent'], ['up', 'arrow-up'], ['down', 'arrow-down'], ['done', 'check'], ['details', 'panel'], ['close', 'keyboard-off']] as const as [action, icon] (action)}
			<button
				type="button"
				class="rounded-lg p-2.5 text-zinc-600 active:bg-zinc-200 disabled:opacity-30 dark:text-zinc-300 dark:active:bg-zinc-700"
				disabled={focusedId === 'ghost' && !['indent', 'outdent', 'close'].includes(action)}
				onpointerdown={(e) => e.preventDefault()}
				onclick={() => toolbar(action)}
				aria-label={action}
			>
				<Icon name={icon} class="size-5" />
			</button>
		{/each}
	</div>
{/if}
