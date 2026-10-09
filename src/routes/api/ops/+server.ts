import { error, json } from '@sveltejs/kit';
import { applyOps } from '#lib/server/repo.ts';
import type { Op } from '#lib/types.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	if (!body || !Array.isArray(body.ops)) error(400, 'expected { ops: [] }');
	if (body.ops.length > 2000) error(413, 'too many ops');
	const result = applyOps(body.ops as Op[]);
	if (result.rejected.length) console.warn('[tasker] rejected ops', result.rejected);
	return json(result);
};
