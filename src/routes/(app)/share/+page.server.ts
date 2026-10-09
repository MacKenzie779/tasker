// PWA share target: text shared from another app on the phone lands in the Inbox.
import { redirect } from '@sveltejs/kit';
import { keyBetween } from '#lib/order.ts';
import { applyOps, loadData } from '#lib/server/repo.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const parts = ['title', 'text', 'url']
		.map((k) => url.searchParams.get(k)?.trim())
		.filter(Boolean) as string[];
	const [title, ...rest] = [...new Set(parts)];
	if (title) {
		const inboxKeys = loadData()
			.tasks.filter((t) => !t.projectId && !t.parentId)
			.map((t) => t.sortKey)
			.sort();
		const now = Date.now();
		applyOps([
			{
				type: 'task.upsert',
				task: {
					id: crypto.randomUUID(),
					parentId: null,
					projectId: null,
					title: title.split('\n')[0].slice(0, 500),
					notes: [title.includes('\n') ? title : '', ...rest].filter(Boolean).join('\n'),
					status: 'todo',
					priority: 0,
					plannedDate: null,
					plannedTime: null,
					deadline: null,
					sortKey: keyBetween(inboxKeys.at(-1), null),
					boardKey: null,
					createdAt: now,
					updatedAt: now,
					completedAt: null
				}
			}
		]);
	}
	redirect(303, '/inbox');
};
