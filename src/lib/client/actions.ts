import { parseTitle } from '#lib/tokens.ts';
import { relativeDayLabel } from '#lib/dates.ts';
import type { Task } from '#lib/types.ts';
import { store } from './store.svelte';
import { ui } from './ui.svelte';

const PRIORITY_LABEL = ['', '!', '!!', '!!!'];

/**
 * Applies inline tokens in a task's title (called on Enter / blur, never while typing).
 * Shows what was picked up, with Undo, so a misparse costs one tap.
 */
export function applyTokens(id: string) {
	const t = store.tasks[id];
	if (!t || !t.title.trim()) return;
	const parsed = parseTitle(t.title, { today: ui.today, projects: store.projectList });
	if (!parsed.changed) return;

	const before: Partial<Task> = {
		title: t.title,
		priority: t.priority,
		projectId: t.projectId,
		plannedDate: t.plannedDate,
		plannedTime: t.plannedTime,
		deadline: t.deadline
	};
	const patch: Partial<Task> = { title: parsed.title };
	const labels: string[] = [];
	if (parsed.plannedDate) {
		patch.plannedDate = parsed.plannedDate;
		patch.plannedTime = parsed.plannedTime ?? null;
		labels.push(
			relativeDayLabel(parsed.plannedDate, ui.today) +
				(parsed.plannedTime ? ` ${parsed.plannedTime}` : '')
		);
	}
	if (parsed.deadline) {
		patch.deadline = parsed.deadline;
		labels.push(`⚑ ${relativeDayLabel(parsed.deadline, ui.today)}`);
	}
	if (parsed.priority !== undefined) {
		patch.priority = parsed.priority;
		labels.push(PRIORITY_LABEL[parsed.priority]);
	}
	// subtasks always follow their parent's project
	if (parsed.projectId && !t.parentId) {
		patch.projectId = parsed.projectId;
		labels.push(`#${store.projects[parsed.projectId]?.name}`);
	}
	if (!labels.length) return;
	store.updateTask(id, patch);
	ui.toast(`“${parsed.title}” → ${labels.join(' · ')}`, {
		label: 'Undo',
		run: () => store.updateTask(id, before)
	});
}

export function deleteWithUndo(id: string) {
	const t = store.tasks[id];
	if (!t) return;
	const snapshot = [t, ...store.descendants(id)].map((x) => ({ ...x }));
	store.deleteTask(id);
	if (ui.selectedId && snapshot.some((s) => s.id === ui.selectedId)) ui.selectedId = null;
	ui.toast(
		`Deleted “${t.title || 'task'}”${snapshot.length > 1 ? ` and ${snapshot.length - 1} subtasks` : ''}`,
		{
			label: 'Undo',
			run: () => store.restoreTasks(snapshot)
		}
	);
}

export function openTask(id: string) {
	ui.selectedId = id;
}
