// Client-side source of truth. Everything is applied locally first (optimistic), then queued as ops
// and flushed to /api/ops in the background. The queue survives reloads (localStorage), so tasks
// captured while briefly offline are not lost.

import { SvelteSet } from 'svelte/reactivity';
import { keyBetween } from '#lib/order.ts';
import { PROJECT_COLORS, type AppData, type Op, type Project, type Task } from '#lib/types.ts';

const QUEUE_KEY = 'tasker.queue.v1';
const COLLAPSED_KEY = 'tasker.collapsed.v1';

// Fields that can be merged into an earlier queued op without changing what that op depends on.
const MERGEABLE = new Set([
	'title',
	'notes',
	'status',
	'priority',
	'plannedDate',
	'plannedTime',
	'deadline',
	'sortKey',
	'boardKey',
	'updatedAt',
	'completedAt',
	'name',
	'color',
	'archivedAt'
]);

export function uid(): string {
	if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
	// crypto.randomUUID is only available in secure contexts (e.g. not on plain http LAN addresses)
	const b = crypto.getRandomValues(new Uint8Array(16));
	b[6] = (b[6] & 0x0f) | 0x40;
	b[8] = (b[8] & 0x3f) | 0x80;
	const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const bySortKey = (a: Task, b: Task) =>
	a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : a.id < b.id ? -1 : 1;

function readJSON<T>(key: string, fallback: T): T {
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
}

function writeJSON(key: string, value: unknown) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		/* storage unavailable: queue stays in memory */
	}
}

const entityId = (op: Op) =>
	op.type === 'task.upsert' ? op.task.id : op.type === 'project.upsert' ? op.project.id : op.id;

class Store {
	tasks: Record<string, Task> = $state({});
	projects: Record<string, Project> = $state({});
	collapsed = new SvelteSet<string>();
	/** done tasks completed after this moment stay visible until reload, so ticking one off doesn't make it jump away */
	sessionStart = Date.now();

	pending = $state(0);
	syncing = $state(false);
	offline = $state(false);

	private queue: Op[] = [];
	private inflight: Op[] = [];
	private flushTimer: ReturnType<typeof setTimeout> | undefined;
	private retryDelay = 2000;
	private initialized = false;

	/** parentId → children sorted by sortKey (roots are under the key "") */
	childrenMap = $derived.by(() => {
		const map = new Map<string, Task[]>();
		for (const t of Object.values(this.tasks)) {
			const key = t.parentId ?? '';
			let list = map.get(key);
			if (!list) map.set(key, (list = []));
			list.push(t);
		}
		for (const list of map.values()) list.sort(bySortKey);
		return map;
	});

	projectList = $derived(
		Object.values(this.projects)
			.filter((p) => !p.archivedAt)
			.sort((a, b) => (a.sortKey < b.sortKey ? -1 : 1))
	);

	// --- lifecycle -------------------------------------------------------------

	init(data: AppData) {
		if (this.initialized) return;
		this.initialized = true;
		this.load(data);
		this.removeBlankLeftovers();
		for (const id of readJSON<string[]>(COLLAPSED_KEY, [])) this.collapsed.add(id);
		const saved = readJSON<Op[]>(QUEUE_KEY, []);
		if (saved.length) {
			this.queue = saved;
			for (const op of saved) this.applyLocal(op);
			this.pending = saved.length;
			this.flush();
		}
		window.addEventListener('online', () => this.flush());
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') this.refresh();
		});
	}

	/** Lines created with Enter but never typed into (e.g. tab closed mid-edit). */
	private removeBlankLeftovers() {
		const cutoff = Date.now() - 60_000;
		for (const t of Object.values(this.tasks)) {
			const blank = !t.title.trim() && !t.notes && !t.plannedDate && !t.deadline && !t.priority;
			if (blank && t.createdAt < cutoff && !this.children(t.id).length) this.deleteTask(t.id);
		}
	}

	load(data: AppData) {
		this.tasks = Object.fromEntries(data.tasks.map((t) => [t.id, t]));
		this.projects = Object.fromEntries(data.projects.map((p) => [p.id, p]));
	}

	/** Pull fresh data (e.g. edits made on another device) when nothing local is pending. */
	async refresh() {
		if (this.queue.length || this.inflight.length) return this.flush();
		const active = document.activeElement;
		if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) return;
		try {
			const res = await fetch('/api/data');
			if (!res.ok) return;
			const data = (await res.json()) as AppData;
			if (!this.queue.length && !this.inflight.length) this.load(data);
		} catch {
			/* offline: keep local state */
		}
	}

	// --- queries ---------------------------------------------------------------

	children(parentId: string | null): Task[] {
		return this.childrenMap.get(parentId ?? '') ?? [];
	}

	isVisible(t: Task, showDone = false): boolean {
		return showDone || t.status !== 'done' || (t.completedAt ?? 0) >= this.sessionStart;
	}

	visibleChildren(parentId: string, showDone = false): Task[] {
		return this.children(parentId).filter((t) => this.isVisible(t, showDone));
	}

	descendants(id: string): Task[] {
		const out: Task[] = [];
		const walk = (pid: string) => {
			for (const c of this.children(pid)) {
				out.push(c);
				walk(c.id);
			}
		};
		walk(id);
		return out;
	}

	ancestors(id: string): Task[] {
		const out: Task[] = [];
		let t = this.tasks[id];
		while (t?.parentId && this.tasks[t.parentId]) {
			t = this.tasks[t.parentId];
			out.unshift(t);
		}
		return out;
	}

	progress(id: string): { done: number; total: number } {
		const kids = this.children(id);
		return { done: kids.filter((k) => k.status === 'done').length, total: kids.length };
	}

	lastChildKey(parentId: string | null): string | null {
		return this.children(parentId).at(-1)?.sortKey ?? null;
	}

	// --- task mutations --------------------------------------------------------

	addTask(fields: Partial<Task>): Task {
		const now = Date.now();
		const parent = fields.parentId ? this.tasks[fields.parentId] : undefined;
		const task: Task = {
			id: uid(),
			parentId: null,
			projectId: parent ? parent.projectId : null,
			title: '',
			notes: '',
			status: 'todo',
			priority: 0,
			plannedDate: null,
			plannedTime: null,
			deadline: null,
			sortKey: '',
			boardKey: null,
			createdAt: now,
			updatedAt: now,
			completedAt: null,
			...fields
		};
		if (!task.sortKey) task.sortKey = keyBetween(this.lastChildKey(task.parentId), null);
		if (task.status === 'done' && !task.completedAt) task.completedAt = now;
		this.tasks[task.id] = task;
		this.enqueue({ type: 'task.upsert', task: $state.snapshot(this.tasks[task.id]) });
		return this.tasks[task.id];
	}

	updateTask(id: string, patch: Partial<Task>) {
		const t = this.tasks[id];
		if (!t) return;
		const now = Date.now();
		const full: Partial<Task> = { ...patch, updatedAt: now };
		if (patch.status !== undefined && patch.status !== t.status) {
			full.completedAt = patch.status === 'done' ? now : null;
		}
		if (patch.plannedDate === null) full.plannedTime = null;
		const projectChanged = patch.projectId !== undefined && patch.projectId !== t.projectId;
		Object.assign(t, full);
		this.enqueue({ type: 'task.update', id, patch: full });
		if (projectChanged) {
			// subtasks always live in their root's project
			for (const d of this.descendants(id)) {
				if (d.projectId === patch.projectId) continue;
				d.projectId = patch.projectId!;
				d.updatedAt = now;
				this.enqueue({
					type: 'task.update',
					id: d.id,
					patch: { projectId: d.projectId, updatedAt: now }
				});
			}
		}
	}

	toggleDone(id: string) {
		const t = this.tasks[id];
		if (t) this.updateTask(id, { status: t.status === 'done' ? 'todo' : 'done' });
	}

	deleteTask(id: string) {
		if (!this.tasks[id]) return;
		const ids = [id, ...this.descendants(id).map((d) => d.id)];
		for (const tid of ids.reverse()) {
			delete this.tasks[tid];
			this.collapsed.delete(tid);
			this.enqueue({ type: 'task.delete', id: tid });
		}
	}

	/** Re-insert a deleted task tree (used by undo). */
	restoreTasks(tasks: Task[]) {
		for (const t of tasks) {
			this.tasks[t.id] = t;
			this.enqueue({ type: 'task.upsert', task: $state.snapshot(this.tasks[t.id]) });
		}
	}

	/** Make `id` the last child of `parentId`. */
	moveInto(id: string, parentId: string) {
		const parent = this.tasks[parentId];
		if (!parent || parentId === id || this.ancestors(parentId).some((a) => a.id === id)) return;
		this.updateTask(id, {
			parentId,
			projectId: parent.projectId,
			sortKey: keyBetween(this.lastChildKey(parentId), null)
		});
		this.setCollapsed(parentId, false);
	}

	/** Move `id` up one level, directly after its current parent. */
	outdent(id: string) {
		const t = this.tasks[id];
		const parent = t?.parentId ? this.tasks[t.parentId] : undefined;
		if (!t || !parent) return;
		const siblings = this.children(parent.parentId);
		const next = siblings[siblings.findIndex((s) => s.id === parent.id) + 1];
		this.updateTask(id, {
			parentId: parent.parentId,
			sortKey: keyBetween(parent.sortKey, next?.sortKey)
		});
	}

	/** Swap with the previous/next sibling. */
	moveSibling(id: string, dir: -1 | 1) {
		const t = this.tasks[id];
		if (!t) return;
		const siblings = this.children(t.parentId).filter(
			(s) => t.parentId !== null || s.projectId === t.projectId
		);
		const i = siblings.findIndex((s) => s.id === id);
		const target = siblings[i + dir];
		if (!target) return;
		const beyond = siblings[i + dir * 2];
		const sortKey =
			dir < 0
				? keyBetween(beyond?.sortKey, target.sortKey)
				: keyBetween(target.sortKey, beyond?.sortKey);
		this.updateTask(id, { sortKey });
	}

	setCollapsed(id: string, value: boolean) {
		if (value === this.collapsed.has(id)) return;
		if (value) this.collapsed.add(id);
		else this.collapsed.delete(id);
		writeJSON(COLLAPSED_KEY, [...this.collapsed]);
	}

	// --- projects --------------------------------------------------------------

	addProject(name: string): Project {
		const all = Object.values(this.projects).sort((a, b) => (a.sortKey < b.sortKey ? -1 : 1));
		const project: Project = {
			id: uid(),
			name: name.trim() || 'Untitled',
			color: PROJECT_COLORS[all.length % PROJECT_COLORS.length],
			sortKey: keyBetween(all.at(-1)?.sortKey, null),
			archivedAt: null,
			createdAt: Date.now()
		};
		this.projects[project.id] = project;
		this.enqueue({ type: 'project.upsert', project });
		return this.projects[project.id];
	}

	updateProject(id: string, patch: Partial<Project>) {
		const p = this.projects[id];
		if (!p) return;
		Object.assign(p, patch);
		this.enqueue({ type: 'project.update', id, patch });
	}

	deleteProject(id: string) {
		for (const t of Object.values(this.tasks)) {
			if (t.projectId === id && !t.parentId) this.deleteTask(t.id);
		}
		delete this.projects[id];
		this.enqueue({ type: 'project.delete', id });
	}

	// --- sync ------------------------------------------------------------------

	private applyLocal(op: Op) {
		switch (op.type) {
			case 'task.upsert':
				this.tasks[op.task.id] = op.task;
				break;
			case 'task.update':
				if (this.tasks[op.id]) Object.assign(this.tasks[op.id], op.patch);
				break;
			case 'task.delete':
				delete this.tasks[op.id];
				break;
			case 'project.upsert':
				this.projects[op.project.id] = op.project;
				break;
			case 'project.update':
				if (this.projects[op.id]) Object.assign(this.projects[op.id], op.patch);
				break;
			case 'project.delete':
				delete this.projects[op.id];
				break;
		}
	}

	private enqueue(op: Op) {
		const id = entityId(op);
		if (op.type === 'task.update' || op.type === 'project.update') {
			const canMergeAnywhere = Object.keys(op.patch).every((k) => MERGEABLE.has(k));
			for (let i = this.queue.length - 1; i >= 0; i--) {
				const q = this.queue[i];
				if (entityId(q) !== id) {
					if (canMergeAnywhere) continue;
					break;
				}
				if (q.type === 'task.upsert' && op.type === 'task.update') Object.assign(q.task, op.patch);
				else if (q.type === 'project.upsert' && op.type === 'project.update')
					Object.assign(q.project, op.patch);
				else if (q.type === op.type) Object.assign(q.patch, op.patch);
				else break;
				return this.persist();
			}
		} else if (op.type === 'task.delete' || op.type === 'project.delete') {
			this.queue = this.queue.filter((q) => entityId(q) !== id);
		}
		this.queue.push(op);
		this.persist();
	}

	private persist() {
		writeJSON(QUEUE_KEY, [...this.inflight, ...this.queue]);
		this.pending = this.queue.length + this.inflight.length;
		clearTimeout(this.flushTimer);
		this.flushTimer = setTimeout(() => this.flush(), 400);
	}

	async flush() {
		if (this.inflight.length || !this.queue.length) return;
		const batch = this.queue.splice(0, 500);
		this.inflight = batch;
		this.syncing = true;
		let retry = false;
		try {
			const res = await fetch('/api/ops', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ ops: batch })
			});
			if (res.status === 401) {
				this.queue.unshift(...batch);
				this.inflight = [];
				writeJSON(QUEUE_KEY, this.queue);
				location.href = '/login?next=' + encodeURIComponent(location.pathname);
				return;
			}
			if (res.status >= 500) throw new Error(`server error ${res.status}`);
			if (!res.ok) console.error('[tasker] ops rejected', res.status, await res.text());
			this.offline = false;
			this.retryDelay = 2000;
		} catch {
			this.queue.unshift(...batch);
			this.offline = true;
			retry = true;
		} finally {
			this.inflight = [];
			this.syncing = false;
			writeJSON(QUEUE_KEY, this.queue);
			this.pending = this.queue.length;
		}
		if (retry) {
			clearTimeout(this.flushTimer);
			this.flushTimer = setTimeout(() => this.flush(), this.retryDelay);
			this.retryDelay = Math.min(this.retryDelay * 2, 60_000);
		} else if (this.queue.length) {
			this.flush();
		}
	}
}

export const store = new Store();
