import { fail, redirect } from '@sveltejs/kit';
import { authEnabled, checkPassword, createSession, isLoggedIn } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

const safeNext = (next: string | null) =>
	next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

export const load: PageServerLoad = ({ cookies, url }) => {
	if (!authEnabled() || isLoggedIn(cookies)) redirect(303, safeNext(url.searchParams.get('next')));
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const password = String(data.get('password') ?? '');
		if (!checkPassword(password)) {
			await new Promise((r) => setTimeout(r, 800));
			return fail(400, { wrong: true });
		}
		createSession(cookies, url.protocol === 'https:');
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
