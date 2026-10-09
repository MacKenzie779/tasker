import type { Task } from '#lib/types.ts';
import { store } from './store.svelte';
import { ui } from './ui.svelte';

const open = (t: Task) => t.status !== 'done';

export const filters = {
	inbox: (t: Task) => !t.projectId && !t.parentId,
	project: (id: string) => (t: Task) => t.projectId === id && !t.parentId,
	day: (day: string) => (t: Task) => t.plannedDate === day || t.deadline === day,
	overdue: (today: string) => (t: Task) =>
		open(t) &&
		t.plannedDate !== today &&
		t.deadline !== today &&
		((!!t.plannedDate && t.plannedDate < today) || (!!t.deadline && t.deadline < today))
};

class Counts {
	inbox = $derived(Object.values(store.tasks).filter((t) => open(t) && filters.inbox(t)).length);
	today = $derived.by(() => {
		const day = filters.day(ui.today);
		const overdue = filters.overdue(ui.today);
		return Object.values(store.tasks).filter((t) => open(t) && (day(t) || overdue(t))).length;
	});
	byProject = $derived.by(() => {
		const out: Record<string, number> = {};
		for (const t of Object.values(store.tasks)) {
			if (t.projectId && !t.parentId && open(t)) out[t.projectId] = (out[t.projectId] ?? 0) + 1;
		}
		return out;
	});
}

export const counts = new Counts();
