import { describe, expect, it } from 'vitest';
import { buildCalendar, escapeText, foldLine } from './ics';
import type { Task } from './types';

const base: Task = {
	id: 't1',
	parentId: null,
	projectId: 'p1',
	title: 'Write report',
	notes: 'Line one\nLine; two, ok',
	status: 'todo',
	priority: 2,
	plannedDate: '2026-10-14',
	plannedTime: null,
	deadline: '2026-10-17',
	sortKey: 'a0',
	boardKey: null,
	createdAt: 0,
	updatedAt: Date.UTC(2026, 9, 1, 8, 0, 0),
	completedAt: null
};
const projects = [
	{ id: 'p1', name: 'Work', color: '#000', sortKey: 'a0', archivedAt: null, createdAt: 0 }
];

describe('ics', () => {
	it('escapes text', () => {
		expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
	});

	it('folds long lines at 75 octets without breaking multibyte chars', () => {
		const line = 'SUMMARY:' + 'ä'.repeat(100);
		const folded = foldLine(line);
		const parts = folded.split('\r\n');
		const enc = new TextEncoder();
		expect(parts.length).toBeGreaterThan(1);
		for (const p of parts) expect(enc.encode(p).length).toBeLessThanOrEqual(75);
		expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line);
	});

	it('emits all-day plan + deadline events', () => {
		const ics = buildCalendar([base], projects, { name: 'Tasks', host: 'example.com' });
		expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
		expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
		expect(ics).toContain('UID:t1-plan@example.com');
		expect(ics).toContain('DTSTART;VALUE=DATE:20261014');
		expect(ics).toContain('DTEND;VALUE=DATE:20261015');
		expect(ics).toContain('SUMMARY:!! Write report');
		expect(ics).toContain('UID:t1-due@example.com');
		expect(ics).toContain('SUMMARY:⚑ Write report');
		expect(ics).toContain('DTSTART;VALUE=DATE:20261017');
		expect(ics).toContain(
			'DESCRIPTION:Line one\\nLine\\; two\\, ok\\nProject: Work\\nDeadline: 2026-10-17'
		);
		expect(ics).toContain('DTSTAMP:20261001T080000Z');
		expect(ics.split('BEGIN:VEVENT').length - 1).toBe(2);
	});

	it('emits timed events with floating local time, rolling past midnight', () => {
		const ics = buildCalendar([{ ...base, deadline: null, plannedTime: '23:45' }], projects, {
			name: 'Tasks',
			host: 'x'
		});
		expect(ics).toContain('DTSTART:20261014T234500');
		expect(ics).toContain('DTEND:20261015T001500');
	});

	it('skips done tasks', () => {
		const ics = buildCalendar([{ ...base, status: 'done' }], projects, { name: 'T', host: 'x' });
		expect(ics).not.toContain('BEGIN:VEVENT');
	});
});
