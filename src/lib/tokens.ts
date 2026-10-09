// Optional inline tokens, applied when a line is committed (Enter / blur).
//
// Anywhere in the line (one word each):
//   !  !!  !!!   priority low / medium / high      (p3 p2 p1 also work)
//   #project     existing project (case-insensitive, unique prefix ok)
//   @fri @17.10 @tomorrow @14:00   planned date / time
//   due:fri  ^fri                  deadline
// At the end of the line only (natural language, English + German):
//   … tomorrow | fri | next week | 17.10 | 17 oct | in 3 days | at 10 | 14:00
//   … due fri | by 17.10 | bis freitag     → deadline
// Anything that doesn't parse stays in the title. A line is never parsed down to nothing.

import type { Priority } from './types';
import { addDays, isValidISODate, startOfWeek, toISODate, weekday } from './dates';

export interface TokenContext {
	today: string;
	projects: { id: string; name: string }[];
}

export interface ParsedTitle {
	title: string;
	changed: boolean;
	priority?: Priority;
	projectId?: string;
	plannedDate?: string;
	plannedTime?: string;
	deadline?: string;
}

const WEEKDAYS: Record<string, number> = {
	mon: 0,
	monday: 0,
	montag: 0,
	tue: 1,
	tues: 1,
	tuesday: 1,
	dienstag: 1,
	wed: 2,
	wednesday: 2,
	mittwoch: 2,
	thu: 3,
	thur: 3,
	thurs: 3,
	thursday: 3,
	donnerstag: 3,
	fri: 4,
	friday: 4,
	freitag: 4,
	sat: 5,
	saturday: 5,
	samstag: 5,
	sun: 6,
	sunday: 6,
	sonntag: 6
};
// Too ambiguous as plain words ("do", "so"), only accepted after @
const WEEKDAYS_EXPLICIT: Record<string, number> = {
	mo: 0,
	di: 1,
	mi: 2,
	do: 3,
	fr: 4,
	sa: 5,
	so: 6
};

const MONTHS: Record<string, number> = {
	jan: 1,
	january: 1,
	januar: 1,
	jän: 1,
	jänner: 1,
	feb: 2,
	february: 2,
	februar: 2,
	mar: 3,
	march: 3,
	mär: 3,
	märz: 3,
	maerz: 3,
	apr: 4,
	april: 4,
	may: 5,
	mai: 5,
	jun: 6,
	june: 6,
	juni: 6,
	jul: 7,
	july: 7,
	juli: 7,
	aug: 8,
	august: 8,
	sep: 9,
	sept: 9,
	september: 9,
	oct: 10,
	october: 10,
	okt: 10,
	oktober: 10,
	nov: 11,
	november: 11,
	dec: 12,
	december: 12,
	dez: 12,
	dezember: 12
};

const TODAY_WORDS = new Set(['today', 'tod', 'heute']);
const TOMORROW_WORDS = new Set(['tomorrow', 'tmr', 'tmrw', 'morgen']);
const NEXT_WORDS = new Set(['next', 'nächste', 'nächsten', 'nächster', 'naechste', 'naechsten']);
const THIS_WORDS = new Set(['this', 'diesen', 'diese', 'dieser', 'kommenden', 'kommender']);
const WEEK_WORDS = new Set(['week', 'woche']);
const DEADLINE_CONNECTORS = new Set(['due', 'by', 'bis', 'deadline', 'until']);
const DATE_CONNECTORS = new Set(['on', 'am']);
const TIME_CONNECTORS = new Set(['at', 'um', '@']);

const pad = (n: number) => String(n).padStart(2, '0');

function upcomingWeekday(wd: number, today: string): string {
	return addDays(today, (wd - weekday(today) + 7) % 7);
}

function nextWeekWeekday(wd: number, today: string): string {
	return addDays(startOfWeek(today), 7 + wd);
}

function buildDate(
	day: number,
	month: number,
	year: number | undefined,
	today: string
): string | null {
	if (year !== undefined && year < 100) year += 2000;
	const y = year ?? Number(today.slice(0, 4));
	let iso = `${y}-${pad(month)}-${pad(day)}`;
	if (!isValidISODate(iso)) return null;
	if (year === undefined && iso < today) {
		iso = `${y + 1}-${pad(month)}-${pad(day)}`;
		if (!isValidISODate(iso)) return null;
	}
	return iso;
}

function parseDayNumber(w: string): number | null {
	const m = /^(\d{1,2})(?:st|nd|rd|th|\.)?$/.exec(w);
	return m ? Number(m[1]) : null;
}

function addUnit(today: string, n: number, unit: string): string | null {
	if (/^(d|day|days|tag|tage|tagen)$/.test(unit)) return addDays(today, n);
	if (/^(w|wk|week|weeks|woche|wochen)$/.test(unit)) return addDays(today, n * 7);
	if (/^(m|mo|month|months|monat|monate|monaten)$/.test(unit)) {
		const d = new Date(
			Number(today.slice(0, 4)),
			Number(today.slice(5, 7)) - 1 + n,
			Number(today.slice(8))
		);
		return toISODate(d);
	}
	return null;
}

/** Parse a date phrase of 1–3 lowercase words. `explicit` = written after @ / due: / ^ */
export function parseDateWords(words: string[], today: string, explicit = false): string | null {
	const [a, b, c] = words;
	if (words.length === 1) {
		if (TODAY_WORDS.has(a)) return today;
		if (TOMORROW_WORDS.has(a)) return addDays(today, 1);
		if (a === 'übermorgen' || a === 'uebermorgen') return addDays(today, 2);
		if (a === 'weekend' || a === 'wochenende') return upcomingWeekday(5, today);
		if (a === 'nextweek' || a === 'next-week') return nextWeekWeekday(0, today);
		if (a in WEEKDAYS) return upcomingWeekday(WEEKDAYS[a], today);
		if (explicit && a in WEEKDAYS_EXPLICIT) return upcomingWeekday(WEEKDAYS_EXPLICIT[a], today);
		let m = /^(\d{1,2})\.(\d{1,2})\.?(\d{2}|\d{4})?$/.exec(a);
		if (m) return buildDate(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : undefined, today);
		m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a);
		if (m) return isValidISODate(a) ? a : null;
		m = /^\+(\d{1,3})([a-z]*)$/.exec(a);
		if (m) return addUnit(today, Number(m[1]), m[2] || 'd');
		if (explicit) {
			m = /^(\d{1,3})(d|w|m)$/.exec(a);
			if (m) return addUnit(today, Number(m[1]), m[2]);
		}
		return null;
	}
	if (words.length === 2) {
		if (NEXT_WORDS.has(a) && WEEK_WORDS.has(b)) return nextWeekWeekday(0, today);
		if (NEXT_WORDS.has(a) && b in WEEKDAYS) return nextWeekWeekday(WEEKDAYS[b], today);
		if (THIS_WORDS.has(a) && b in WEEKDAYS) return upcomingWeekday(WEEKDAYS[b], today);
		if (THIS_WORDS.has(a) && (b === 'weekend' || b === 'wochenende'))
			return upcomingWeekday(5, today);
		if (a === 'in') {
			const m = /^(\d{1,3})(d|w)$/.exec(b);
			if (m) return addUnit(today, Number(m[1]), m[2]);
		}
		const day = parseDayNumber(a);
		if (day !== null && b in MONTHS) return buildDate(day, MONTHS[b], undefined, today);
		const day2 = parseDayNumber(b);
		if (a in MONTHS && day2 !== null) return buildDate(day2, MONTHS[a], undefined, today);
		return null;
	}
	if (words.length === 3) {
		if (a === 'in' && /^\d{1,3}$/.test(b)) return addUnit(today, Number(b), c);
		const day = parseDayNumber(a);
		if (day !== null && b in MONTHS && /^\d{4}$/.test(c))
			return buildDate(day, MONTHS[b], Number(c), today);
		return null;
	}
	return null;
}

/** Parse a time of 1–2 lowercase words: "14:00", "9am", "2:30pm", "14h", "14 uhr", "3 pm" */
export function parseTime(words: string[]): string | null {
	const s = words.join(' ');
	let m = /^(\d{1,2}):(\d{2})(?:\s?uhr|\s?h)?$/.exec(s);
	if (m) return hm(Number(m[1]), Number(m[2]));
	m = /^(\d{1,2})(?::(\d{2}))?\s?(am|pm)$/.exec(s);
	if (m) {
		let h = Number(m[1]);
		if (h < 1 || h > 12) return null;
		if (m[3] === 'pm' && h !== 12) h += 12;
		if (m[3] === 'am' && h === 12) h = 0;
		return hm(h, Number(m[2] ?? 0));
	}
	m = /^(\d{1,2})\s?(h|uhr)$/.exec(s);
	if (m) return hm(Number(m[1]), 0);
	return null;
}

function hm(h: number, m: number): string | null {
	if (h > 23 || m > 59) return null;
	return `${pad(h)}:${pad(m)}`;
}

function normalizeName(s: string): string {
	return s.toLowerCase().replace(/[\s\-_.]+/g, '');
}

function matchProject(query: string, projects: TokenContext['projects']): string | undefined {
	const q = normalizeName(query);
	if (!q) return undefined;
	const exact = projects.find((p) => normalizeName(p.name) === q);
	if (exact) return exact.id;
	if (q.length < 2) return undefined;
	const prefixed = projects.filter((p) => normalizeName(p.name).startsWith(q));
	return prefixed.length === 1 ? prefixed[0].id : undefined;
}

const clean = (w: string) => w.toLowerCase().replace(/[,;]+$/, '');

export function parseTitle(input: string, ctx: TokenContext): ParsedTitle {
	const unchanged: ParsedTitle = { title: input, changed: false };
	let words = input.trim().split(/\s+/).filter(Boolean);
	if (words.length < 2) return unchanged;

	const res: ParsedTitle = { title: '', changed: false };

	// Pass 1: explicit single-word tokens, anywhere in the line
	words = words.filter((word) => {
		const w = clean(word);
		let m: RegExpExecArray | null;
		if (res.priority === undefined && /^!{1,3}$/.test(w)) {
			res.priority = w.length as Priority;
			return false;
		}
		if (res.priority === undefined && (m = /^p([1-3])$/.exec(w))) {
			res.priority = (4 - Number(m[1])) as Priority;
			return false;
		}
		if (res.projectId === undefined && (m = /^#(.+)$/.exec(word))) {
			const id = matchProject(m[1], ctx.projects);
			if (id) {
				res.projectId = id;
				return false;
			}
		}
		if ((m = /^@(.+)$/.exec(w))) {
			const time = parseTime([m[1]]);
			if (time && !res.plannedTime) {
				res.plannedTime = time;
				return false;
			}
			const date = parseDateWords([m[1]], ctx.today, true);
			if (date && !res.plannedDate) {
				res.plannedDate = date;
				return false;
			}
		}
		if ((m = /^(?:\^|due:|bis:|deadline:)(.+)$/.exec(w))) {
			const date = parseDateWords([m[1]], ctx.today, true);
			if (date && !res.deadline) {
				res.deadline = date;
				return false;
			}
		}
		return true;
	});

	// Pass 2: natural language at the end of the line
	for (let guard = 0; guard < 6 && words.length > 1; guard++) {
		const lower = words.map(clean);
		const n = words.length;
		let consumed = false;

		if (!res.plannedTime) {
			let time: string | null = null;
			let take = 0;
			if (n >= 3 && TIME_CONNECTORS.has(lower[n - 2]) && /^\d{1,2}$/.test(lower[n - 1])) {
				time = hm(Number(lower[n - 1]), 0);
				take = 2;
			} else {
				for (const len of [2, 1]) {
					if (n - len < 1) continue;
					time = parseTime(lower.slice(n - len));
					if (time) {
						take = len;
						if (n - len - 1 >= 1 && TIME_CONNECTORS.has(lower[n - len - 1])) take++;
						break;
					}
				}
			}
			if (time) {
				res.plannedTime = time;
				words = words.slice(0, n - take);
				consumed = true;
			}
		}
		if (consumed) continue;

		for (const len of [3, 2, 1]) {
			if (n - len < 1) continue;
			const date = parseDateWords(lower.slice(n - len), ctx.today);
			if (!date) continue;
			const connector = n - len - 1 >= 1 ? lower[n - len - 1] : '';
			const isDeadline = DEADLINE_CONNECTORS.has(connector);
			if (isDeadline ? res.deadline : res.plannedDate) break;
			if (isDeadline) res.deadline = date;
			else res.plannedDate = date;
			const take = len + (isDeadline || DATE_CONNECTORS.has(connector) ? 1 : 0);
			words = words.slice(0, n - take);
			consumed = true;
			break;
		}
		if (!consumed) break;
	}

	if (res.plannedTime && !res.plannedDate) res.plannedDate = ctx.today;

	const title = words.join(' ');
	const changed =
		res.priority !== undefined ||
		res.projectId !== undefined ||
		res.plannedDate !== undefined ||
		res.deadline !== undefined;
	if (!changed || !title) return unchanged;
	return { ...res, title, changed: true };
}
