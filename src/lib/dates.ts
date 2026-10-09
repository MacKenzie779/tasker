// All dates are plain local calendar days as YYYY-MM-DD strings.

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(iso: string): Date {
	const [y, m, d] = iso.split('-').map(Number);
	return new Date(y, m - 1, d);
}

export function todayISO(): string {
	return toISODate(new Date());
}

export function addDays(iso: string, n: number): string {
	const d = fromISODate(iso);
	d.setDate(d.getDate() + n);
	return toISODate(d);
}

export function addMonths(iso: string, n: number): string {
	const d = fromISODate(iso);
	d.setDate(1);
	d.setMonth(d.getMonth() + n);
	return toISODate(d);
}

export function diffDays(a: string, b: string): number {
	return Math.round((fromISODate(a).getTime() - fromISODate(b).getTime()) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday */
export function weekday(iso: string): number {
	return (fromISODate(iso).getDay() + 6) % 7;
}

export function startOfWeek(iso: string): string {
	return addDays(iso, -weekday(iso));
}

export function isValidISODate(iso: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
	return toISODate(fromISODate(iso)) === iso;
}

/** 6×7 grid of days covering the month that contains `iso`, starting on Monday. */
export function monthGrid(iso: string): string[] {
	const first = iso.slice(0, 8) + '01';
	const start = startOfWeek(first);
	return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS_SHORT = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
];
const MONTHS_LONG = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

export const weekdayShort = (iso: string) => WEEKDAYS_SHORT[weekday(iso)];
export const WEEKDAY_NAMES = WEEKDAYS_SHORT;

export function monthLabel(iso: string): string {
	const d = fromISODate(iso);
	return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Today", "Tomorrow", "Yesterday", "Fri" (within a week), "17 Oct", "17 Oct 2027" */
export function relativeDayLabel(iso: string, today: string = todayISO()): string {
	const diff = diffDays(iso, today);
	if (diff === 0) return 'Today';
	if (diff === 1) return 'Tomorrow';
	if (diff === -1) return 'Yesterday';
	if (diff > 1 && diff < 7) return weekdayShort(iso);
	const d = fromISODate(iso);
	const base = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
	return d.getFullYear() === fromISODate(today).getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** "Fri 17 Oct" */
export function longDayLabel(iso: string): string {
	const d = fromISODate(iso);
	return `${weekdayShort(iso)} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}
