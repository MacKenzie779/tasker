import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema';
import { DATABASE_URL } from '$app/env/private';
import { building } from '$app/env';

export type DB = BetterSQLite3Database<typeof schema>;

function open(): DB {
	if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
	mkdirSync(dirname(DATABASE_URL), { recursive: true });
	const client = new Database(DATABASE_URL);
	client.pragma('journal_mode = WAL');
	client.pragma('foreign_keys = ON');
	client.pragma('busy_timeout = 5000');
	const db = drizzle(client, { schema });
	migrate(db, { migrationsFolder: process.env.MIGRATIONS_DIR ?? 'drizzle' });
	return db;
}

// Not opened while SvelteKit analyses the app during `vite build`.
export const db: DB = building ? (undefined as unknown as DB) : open();
