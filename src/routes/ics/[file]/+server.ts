import { error } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { buildCalendar } from '#lib/ics.ts';
import { icsToken, loadCalendarTasks } from '#lib/server/repo.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url }) => {
	const token = params.file.replace(/\.ics$/, '');
	const expected = icsToken();
	const ok =
		token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected));
	if (!ok) error(404, 'Not found');

	const projectId = url.searchParams.get('project') ?? undefined;
	const { tasks, projects } = loadCalendarTasks(projectId);
	const project = projectId ? projects.find((p) => p.id === projectId) : undefined;
	if (projectId && !project) error(404, 'Not found');

	const body = buildCalendar(tasks, projects, {
		name: project ? `Tasks · ${project.name}` : 'Tasks',
		host: url.hostname
	});
	return new Response(body, {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': `inline; filename="tasks.ics"`,
			'cache-control': 'no-cache'
		}
	});
};
