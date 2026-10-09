import { redirect } from '@sveltejs/kit';
import { authEnabled, clearSession } from '#lib/server/auth.ts';
import { icsToken, regenerateIcsToken } from '#lib/server/repo.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ icsToken: icsToken(), authEnabled: authEnabled() });

export const actions: Actions = {
	regenerate: () => {
		regenerateIcsToken();
	},
	logout: ({ cookies }) => {
		clearSession(cookies);
		redirect(303, '/login');
	}
};
