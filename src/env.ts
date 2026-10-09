import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'Path to the SQLite database file.',
		schema: (value) => value || 'data/tasker.db'
	},
	TASKER_PASSWORD: {
		description:
			'Password for the single user. If unset, the app runs without login (local use only).',
		schema: (value) => value || undefined
	}
});
