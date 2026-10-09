export type Status = 'todo' | 'doing' | 'done';

export const STATUSES: { id: Status; label: string }[] = [
	{ id: 'todo', label: 'To do' },
	{ id: 'doing', label: 'Doing' },
	{ id: 'done', label: 'Done' }
];

/** 0 = none, 1 = low (!), 2 = medium (!!), 3 = high (!!!) */
export type Priority = 0 | 1 | 2 | 3;

export interface Task {
	id: string;
	parentId: string | null;
	projectId: string | null;
	title: string;
	notes: string;
	status: Status;
	priority: Priority;
	/** YYYY-MM-DD, the day you plan to do it */
	plannedDate: string | null;
	/** HH:MM, optional time on the planned date */
	plannedTime: string | null;
	/** YYYY-MM-DD, when it is due */
	deadline: string | null;
	/** order among siblings (fractional index) */
	sortKey: string;
	/** order inside a kanban column; falls back to sortKey */
	boardKey: string | null;
	createdAt: number;
	updatedAt: number;
	completedAt: number | null;
}

export interface Project {
	id: string;
	name: string;
	color: string;
	sortKey: string;
	archivedAt: number | null;
	createdAt: number;
}

export type Op =
	| { type: 'task.upsert'; task: Task }
	| { type: 'task.update'; id: string; patch: Partial<Task> }
	| { type: 'task.delete'; id: string }
	| { type: 'project.upsert'; project: Project }
	| { type: 'project.update'; id: string; patch: Partial<Project> }
	| { type: 'project.delete'; id: string };

export interface AppData {
	tasks: Task[];
	projects: Project[];
}

export const PROJECT_COLORS = [
	'#6366f1',
	'#0ea5e9',
	'#10b981',
	'#84cc16',
	'#f59e0b',
	'#f97316',
	'#ef4444',
	'#ec4899',
	'#a855f7',
	'#64748b'
];
