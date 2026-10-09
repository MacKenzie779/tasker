import { and, eq, gt, isNotNull, ne, or } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { db } from './db';
import { project, setting, task } from './db/schema';
import type { AppData, Op, Project, Task } from '#lib/types.ts';

const DONE_HISTORY_MS = 30 * 86_400_000;

export function loadData(): AppData {
	const since = Date.now() - DONE_HISTORY_MS;
	const tasks = db
		.select()
		.from(task)
		.where(or(ne(task.status, 'done'), gt(task.completedAt, since)))
		.all() as Task[];
	const projects = db.select().from(project).all() as Project[];
	return { tasks, projects };
}

/** Everything the calendar feed needs: open tasks with a planned date or a deadline. */
export function loadCalendarTasks(projectId?: string): { tasks: Task[]; projects: Project[] } {
	const dated = or(isNotNull(task.plannedDate), isNotNull(task.deadline));
	const tasks = db
		.select()
		.from(task)
		.where(
			and(ne(task.status, 'done'), dated, projectId ? eq(task.projectId, projectId) : undefined)
		)
		.all() as Task[];
	// parents are needed for "Part of: …" even if they are not dated themselves
	const parentIds = new Set(tasks.map((t) => t.parentId).filter((id): id is string => !!id));
	const known = new Set(tasks.map((t) => t.id));
	const parents = [...parentIds]
		.filter((id) => !known.has(id))
		.map((id) => db.select().from(task).where(eq(task.id, id)).get() as Task | undefined)
		.filter((t): t is Task => !!t)
		.map((t) => ({ ...t, plannedDate: null, deadline: null }));
	return { tasks: [...tasks, ...parents], projects: db.select().from(project).all() as Project[] };
}

// --- op validation -----------------------------------------------------------

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

type Check = (v: unknown) => boolean;
const str: Check = (v) => typeof v === 'string';
const strOrNull: Check = (v) => v === null || typeof v === 'string';
const num: Check = (v) => typeof v === 'number' && Number.isFinite(v);
const numOrNull: Check = (v) => v === null || num(v);
const dateOrNull: Check = (v) => v === null || (typeof v === 'string' && DATE.test(v));

const TASK_FIELDS: Record<keyof Task, Check> = {
	id: str,
	parentId: strOrNull,
	projectId: strOrNull,
	title: str,
	notes: str,
	status: (v) => v === 'todo' || v === 'doing' || v === 'done',
	priority: (v) => v === 0 || v === 1 || v === 2 || v === 3,
	plannedDate: dateOrNull,
	plannedTime: (v) => v === null || (typeof v === 'string' && TIME.test(v)),
	deadline: dateOrNull,
	sortKey: str,
	boardKey: strOrNull,
	createdAt: num,
	updatedAt: num,
	completedAt: numOrNull
};

const PROJECT_FIELDS: Record<keyof Project, Check> = {
	id: str,
	name: str,
	color: str,
	sortKey: str,
	archivedAt: numOrNull,
	createdAt: num
};

function pick<T>(input: unknown, fields: Record<string, Check>, requireAll: boolean): Partial<T> {
	if (!input || typeof input !== 'object') throw new Error('invalid payload');
	const out: Record<string, unknown> = {};
	for (const [key, check] of Object.entries(fields)) {
		const value = (input as Record<string, unknown>)[key];
		if (value === undefined) {
			if (requireAll) throw new Error(`missing ${key}`);
			continue;
		}
		if (!check(value)) throw new Error(`invalid ${key}`);
		out[key] = value;
	}
	return out as Partial<T>;
}

function applyOp(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], op: Op) {
	switch (op.type) {
		case 'task.upsert': {
			const values = pick<Task>(op.task, TASK_FIELDS, true) as Task;
			const { id: _id, ...rest } = values;
			tx.insert(task).values(values).onConflictDoUpdate({ target: task.id, set: rest }).run();
			return;
		}
		case 'task.update': {
			const patch = pick<Task>(op.patch, TASK_FIELDS, false);
			delete patch.id;
			if (Object.keys(patch).length) tx.update(task).set(patch).where(eq(task.id, op.id)).run();
			return;
		}
		case 'task.delete':
			tx.delete(task).where(eq(task.id, op.id)).run();
			return;
		case 'project.upsert': {
			const values = pick<Project>(op.project, PROJECT_FIELDS, true) as Project;
			const { id: _id, ...rest } = values;
			tx.insert(project).values(values).onConflictDoUpdate({ target: project.id, set: rest }).run();
			return;
		}
		case 'project.update': {
			const patch = pick<Project>(op.patch, PROJECT_FIELDS, false);
			delete patch.id;
			if (Object.keys(patch).length)
				tx.update(project).set(patch).where(eq(project.id, op.id)).run();
			return;
		}
		case 'project.delete':
			tx.delete(project).where(eq(project.id, op.id)).run();
			return;
		default:
			throw new Error('unknown op');
	}
}

/**
 * Applies a batch of client ops in one transaction. Each op runs in its own savepoint so a single
 * stale op (e.g. an update for a task deleted on another device) can't block the rest of the queue.
 */
export function applyOps(ops: Op[]): {
	applied: number;
	rejected: { index: number; error: string }[];
} {
	const rejected: { index: number; error: string }[] = [];
	db.transaction((tx) => {
		ops.forEach((op, index) => {
			try {
				tx.transaction((inner) => applyOp(inner, op));
			} catch (e) {
				rejected.push({ index, error: e instanceof Error ? e.message : String(e) });
			}
		});
	});
	return { applied: ops.length - rejected.length, rejected };
}

// --- settings ----------------------------------------------------------------

export function getSetting(key: string): string | undefined {
	return db.select().from(setting).where(eq(setting.key, key)).get()?.value;
}

export function setSetting(key: string, value: string) {
	db.insert(setting)
		.values({ key, value })
		.onConflictDoUpdate({ target: setting.key, set: { value } })
		.run();
}

export function icsToken(): string {
	return getSetting('ics_token') ?? regenerateIcsToken();
}

export function regenerateIcsToken(): string {
	const token = randomBytes(18).toString('base64url');
	setSetting('ics_token', token);
	return token;
}
