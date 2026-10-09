import { generateKeyBetween } from 'fractional-indexing';

/** A sort key strictly between a and b (either may be null = open end). Tolerates inconsistent neighbours. */
export function keyBetween(a: string | null | undefined, b: string | null | undefined): string {
	const lo = a ?? null;
	let hi = b ?? null;
	if (lo !== null && hi !== null && lo >= hi) hi = null;
	try {
		return generateKeyBetween(lo, hi);
	} catch {
		try {
			return generateKeyBetween(lo, null);
		} catch {
			return generateKeyBetween(null, hi);
		}
	}
}
