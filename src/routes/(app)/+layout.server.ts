import { loadData } from '#lib/server/repo.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => loadData();
