// Minimal RFC 5545 writer for the subscribable calendar feed.
// Planned tasks → events (all-day, or a 30 min block when a time is set; floating local time).
// Deadlines → all-day "⚑" events. Done tasks are left out.

import type { Project, Task } from './types';
import { addDays } from './dates';

export interface IcsOptions {
	name: string;
	host: string;
	/** default event length for timed tasks, minutes */
	duration?: number;
}

export function escapeText(s: string): string {
	return s
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\r?\n/g, '\\n');
}

const encoder = new TextEncoder();

/** Fold a content line at 75 octets without splitting UTF-8 sequences. */
export function foldLine(line: string): string {
	if (encoder.encode(line).length <= 75) return line;
	const parts: string[] = [];
	let current = '';
	let bytes = 0;
	let limit = 75;
	for (const ch of line) {
		const len = encoder.encode(ch).length;
		if (bytes + len > limit) {
			parts.push(current);
			current = '';
			bytes = 0;
			limit = 74; // continuation lines start with a space
		}
		current += ch;
		bytes += len;
	}
	parts.push(current);
	return parts.join('\r\n ');
}

const pad = (n: number) => String(n).padStart(2, '0');

function utcStamp(ms: number): string {
	const d = new Date(ms);
	return (
		`${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
		`T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
	);
}

const icsDate = (iso: string) => iso.replace(/-/g, '');

function floatingDateTime(iso: string, time: string, plusMinutes = 0): string {
	const [y, m, d] = iso.split('-').map(Number);
	const [h, min] = time.split(':').map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d, h, min + plusMinutes));
	return (
		`${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}` +
		`T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00`
	);
}

const PRIORITY_MARK = ['', '! ', '!! ', '!!! '];

export function buildCalendar(tasks: Task[], projects: Project[], opts: IcsOptions): string {
	const projectById = new Map(projects.map((p) => [p.id, p]));
	const taskById = new Map(tasks.map((t) => [t.id, t]));
	const duration = opts.duration ?? 30;
	const lines: string[] = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Tasker//Tasks//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		`X-WR-CALNAME:${escapeText(opts.name)}`,
		'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
		'X-PUBLISHED-TTL:PT15M'
	];

	for (const task of tasks) {
		if (task.status === 'done') continue;
		const project = task.projectId ? projectById.get(task.projectId) : undefined;
		const parent = task.parentId ? taskById.get(task.parentId) : undefined;
		const description = [
			task.notes,
			parent ? `Part of: ${parent.title}` : '',
			project ? `Project: ${project.name}` : '',
			task.deadline ? `Deadline: ${task.deadline}` : ''
		]
			.filter(Boolean)
			.join('\n');
		const title = task.title || 'Untitled task';
		const common = [
			`DTSTAMP:${utcStamp(task.updatedAt)}`,
			`LAST-MODIFIED:${utcStamp(task.updatedAt)}`,
			...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
			...(project ? [`CATEGORIES:${escapeText(project.name)}`] : [])
		];

		if (task.plannedDate) {
			lines.push('BEGIN:VEVENT', `UID:${task.id}-plan@${opts.host}`, ...common);
			lines.push(`SUMMARY:${escapeText(PRIORITY_MARK[task.priority] + title)}`);
			if (task.plannedTime) {
				lines.push(
					`DTSTART:${floatingDateTime(task.plannedDate, task.plannedTime)}`,
					`DTEND:${floatingDateTime(task.plannedDate, task.plannedTime, duration)}`
				);
			} else {
				lines.push(
					`DTSTART;VALUE=DATE:${icsDate(task.plannedDate)}`,
					`DTEND;VALUE=DATE:${icsDate(addDays(task.plannedDate, 1))}`,
					'TRANSP:TRANSPARENT'
				);
			}
			lines.push('END:VEVENT');
		}
		if (task.deadline) {
			lines.push('BEGIN:VEVENT', `UID:${task.id}-due@${opts.host}`, ...common);
			lines.push(
				`SUMMARY:${escapeText('⚑ ' + title)}`,
				`DTSTART;VALUE=DATE:${icsDate(task.deadline)}`,
				`DTEND;VALUE=DATE:${icsDate(addDays(task.deadline, 1))}`,
				'TRANSP:TRANSPARENT',
				'END:VEVENT'
			);
		}
	}

	lines.push('END:VCALENDAR');
	return lines.map(foldLine).join('\r\n') + '\r\n';
}
