import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'rm -f data/e2e.db data/e2e.db-* && npm run build && npm run preview',
		port: 4173,
		env: { DATABASE_URL: 'data/e2e.db', TASKER_PASSWORD: '' },
		reuseExistingServer: false
	},
	use: { baseURL: 'http://localhost:4173' },
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	workers: 1
});
