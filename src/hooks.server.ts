import { json, redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { isLoggedIn } from '#lib/server/auth.ts';

const PUBLIC = [/^\/login\/?$/, /^\/ics\//, /^\/manifest\.webmanifest$/, /^\/service-worker\.js$/];

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	if (!PUBLIC.some((re) => re.test(path)) && !isLoggedIn(event.cookies)) {
		if (path.startsWith('/api/')) return json({ error: 'unauthorized' }, { status: 401 });
		const next = path === '/' ? '' : `?next=${encodeURIComponent(path + event.url.search)}`;
		redirect(303, `/login${next}`);
	}
	return resolve(event);
};
