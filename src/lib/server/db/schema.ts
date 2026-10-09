import { integer, sqliteTable, text, index, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

export const project = sqliteTable('project', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	color: text('color').notNull(),
	sortKey: text('sort_key').notNull(),
	archivedAt: integer('archived_at'),
	createdAt: integer('created_at').notNull()
});

export const task = sqliteTable(
	'task',
	{
		id: text('id').primaryKey(),
		parentId: text('parent_id').references((): AnySQLiteColumn => task.id, { onDelete: 'cascade' }),
		projectId: text('project_id').references(() => project.id, { onDelete: 'set null' }),
		title: text('title').notNull().default(''),
		notes: text('notes').notNull().default(''),
		status: text('status', { enum: ['todo', 'doing', 'done'] })
			.notNull()
			.default('todo'),
		priority: integer('priority').notNull().default(0),
		plannedDate: text('planned_date'),
		plannedTime: text('planned_time'),
		deadline: text('deadline'),
		sortKey: text('sort_key').notNull(),
		boardKey: text('board_key'),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull(),
		completedAt: integer('completed_at')
	},
	(t) => [
		index('task_parent_idx').on(t.parentId),
		index('task_project_idx').on(t.projectId),
		index('task_planned_idx').on(t.plannedDate)
	]
);

export const setting = sqliteTable('setting', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});
