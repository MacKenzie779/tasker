import { json } from '@sveltejs/kit';
import { loadData } from '#lib/server/repo.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	json(loadData(), { headers: { 'cache-control': 'no-store' } });
