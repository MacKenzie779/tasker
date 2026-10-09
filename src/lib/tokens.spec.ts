import { describe, expect, it } from 'vitest';
import { parseTitle, parseDateWords, parseTime } from './tokens';

// Wednesday
const today = '2026-10-07';
const ctx = {
	today,
	projects: [
		{ id: 'p-health', name: 'Health' },
		{ id: 'p-side', name: 'Side Projects' },
		{ id: 'p-sidequest', name: 'Sidequest' }
	]
};
const parse = (s: string) => parseTitle(s, ctx);

describe('parseTitle', () => {
	it('leaves plain text alone', () => {
		expect(parse('Buy milk')).toEqual({ title: 'Buy milk', changed: false });
		expect(parse('Read chapter 5')).toMatchObject({ title: 'Read chapter 5', changed: false });
		expect(parse('Watch Friday the 13th')).toMatchObject({ changed: false });
	});

	it('does not treat C# or unknown projects as tokens', () => {
		expect(parse('Learn C# basics')).toMatchObject({ changed: false });
		expect(parse('Fix bug #123')).toMatchObject({ changed: false, title: 'Fix bug #123' });
	});

	it('parses the example from the plan', () => {
		expect(parse('Call dentist fri !! #health')).toEqual({
			title: 'Call dentist',
			changed: true,
			priority: 2,
			projectId: 'p-health',
			plannedDate: '2026-10-09'
		});
	});

	it('parses priorities', () => {
		expect(parse('Pay rent !!!').priority).toBe(3);
		expect(parse('Pay rent !').priority).toBe(1);
		expect(parse('Pay rent p1').priority).toBe(3);
		expect(parse('Pay rent p3').priority).toBe(1);
	});

	it('matches projects by unique prefix and ignores separators', () => {
		expect(parse('Ship it #side-projects').projectId).toBe('p-side');
		expect(parse('Ship it #heal').projectId).toBe('p-health');
		// "#side" is ambiguous between two projects
		expect(parse('Ship it #side')).toMatchObject({ changed: false });
	});

	it('parses trailing natural dates (EN + DE)', () => {
		expect(parse('Report tomorrow')).toMatchObject({ title: 'Report', plannedDate: '2026-10-08' });
		expect(parse('Report morgen')).toMatchObject({ plannedDate: '2026-10-08' });
		expect(parse('Report next week')).toMatchObject({ title: 'Report', plannedDate: '2026-10-12' });
		expect(parse('Report nächste Woche')).toMatchObject({ plannedDate: '2026-10-12' });
		expect(parse('Report in 3 days')).toMatchObject({ plannedDate: '2026-10-10' });
		expect(parse('Gym on mon')).toMatchObject({ title: 'Gym', plannedDate: '2026-10-12' });
		expect(parse('Taxes 17.10')).toMatchObject({ plannedDate: '2026-10-17' });
		expect(parse('Taxes 17 oct')).toMatchObject({ plannedDate: '2026-10-17' });
		expect(parse('Taxes oct 17th')).toMatchObject({ plannedDate: '2026-10-17' });
	});

	it('rolls numeric dates without a year into next year when past', () => {
		expect(parse('Renew passport 3.1')).toMatchObject({ plannedDate: '2027-01-03' });
	});

	it('treats a weekday equal to today as today', () => {
		expect(parse('Standup wed').plannedDate).toBe('2026-10-07');
	});

	it('parses times and defaults the date to today', () => {
		expect(parse('Call Anna at 10')).toMatchObject({
			title: 'Call Anna',
			plannedDate: today,
			plannedTime: '10:00'
		});
		expect(parse('Call mom tomorrow at 9am')).toMatchObject({
			title: 'Call mom',
			plannedDate: '2026-10-08',
			plannedTime: '09:00'
		});
		expect(parse('Zahnarzt anrufen morgen um 14 uhr')).toMatchObject({
			title: 'Zahnarzt anrufen',
			plannedDate: '2026-10-08',
			plannedTime: '14:00'
		});
	});

	it('parses deadlines', () => {
		expect(parse('Submit report by friday')).toMatchObject({
			title: 'Submit report',
			deadline: '2026-10-09'
		});
		expect(parse('Steuer bis 31.12')).toMatchObject({ title: 'Steuer', deadline: '2026-12-31' });
		expect(parse('Essay due:20.10 tomorrow')).toMatchObject({
			title: 'Essay',
			deadline: '2026-10-20',
			plannedDate: '2026-10-08'
		});
		expect(parse('Essay ^fri')).toMatchObject({ deadline: '2026-10-09' });
	});

	it('parses explicit @ tokens anywhere', () => {
		expect(parse('@fri buy flowers')).toMatchObject({
			title: 'buy flowers',
			plannedDate: '2026-10-09'
		});
		expect(parse('Pick up @do kids')).toMatchObject({
			title: 'Pick up kids',
			plannedDate: '2026-10-08'
		});
		expect(parse('Pick up kids @14:30')).toMatchObject({
			plannedTime: '14:30',
			plannedDate: today
		});
	});

	it('never parses a line down to nothing', () => {
		expect(parse('tomorrow')).toMatchObject({ title: 'tomorrow', changed: false });
		expect(parse('!! #health')).toMatchObject({ title: '!! #health', changed: false });
		expect(parse('Friday tomorrow')).toMatchObject({ title: 'Friday', plannedDate: '2026-10-08' });
	});
});

describe('helpers', () => {
	it('parseDateWords rejects invalid dates', () => {
		expect(parseDateWords(['31.02'], today)).toBeNull();
		expect(parseDateWords(['2026-13-01'], today)).toBeNull();
	});
	it('parseTime', () => {
		expect(parseTime(['12pm'])).toBe('12:00');
		expect(parseTime(['12am'])).toBe('00:00');
		expect(parseTime(['2:30pm'])).toBe('14:30');
		expect(parseTime(['25:00'])).toBeNull();
		expect(parseTime(['17.10'])).toBeNull();
	});
});
