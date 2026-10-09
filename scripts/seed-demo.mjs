// Fills a running Tasker instance with demo data (projects, nested tasks, dates, kanban states).
// Usage: node scripts/seed-demo.mjs [base-url]   (default http://localhost:5173, login must be disabled)
import { generateNKeysBetween } from 'fractional-indexing';

const BASE = process.argv[2] ?? 'http://localhost:5173';
const pad = (n) => String(n).padStart(2, '0');
const day = (offset) => {
	const d = new Date();
	d.setDate(d.getDate() + offset);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const projects = [
	{ key: 'work', name: 'Work', color: '#6366f1' },
	{ key: 'home', name: 'Home', color: '#10b981' },
	{ key: 'health', name: 'Health', color: '#ec4899' },
	{ key: 'lisbon', name: 'Trip to Lisbon', color: '#f59e0b' }
];

// [title, fields, children]
const tree = {
	inbox: [
		['Call the plumber about the kitchen sink', {}],
		['Look into a standing desk', { priority: 1 }],
		[
			'Birthday present for Anna',
			{ deadline: day(6) },
			[['Ask Tom for ideas'], ['Order before Friday']]
		],
		['Read “Thinking in Systems”', {}],
		['Cancel the unused streaming subscription', {}]
	],
	work: [
		[
			'Q4 planning document',
			{ priority: 2, status: 'doing', deadline: day(4) },
			[
				['Collect input from the team', { status: 'done' }],
				['Draft goals and key results'],
				['Review with Sarah', { plannedDate: day(2), plannedTime: '14:00' }]
			]
		],
		['Fix flaky CI pipeline', { priority: 3, status: 'doing', plannedDate: day(0) }],
		['Team retro', { plannedDate: day(0), plannedTime: '15:30' }],
		['Submit expense report', { deadline: day(0), priority: 2 }],
		[
			'Onboarding for the new hire',
			{ plannedDate: day(3) },
			[['Laptop & accounts'], ['Pair-programming schedule'], ['Welcome lunch']]
		],
		['Write release notes for v2.4', { plannedDate: day(1) }],
		['Update API documentation', {}],
		['Ship dark mode', { status: 'done' }],
		['Migrate dashboards to new metrics', { status: 'done' }]
	],
	home: [
		[
			'Weekend groceries',
			{ plannedDate: day(0) },
			[['Oat milk'], ['Tomatoes & basil'], ['Coffee beans', { status: 'done' }]]
		],
		['Renew car insurance', { deadline: day(9), priority: 2 }],
		['Fix the bike brakes', { plannedDate: day(5) }],
		['Book the chimney sweep', {}],
		['Water the balcony plants', { plannedDate: day(1) }],
		['Sort out the basement', { status: 'doing' }]
	],
	health: [
		['Dentist check-up', { plannedDate: day(3), plannedTime: '10:30' }],
		['Run 5 km', { plannedDate: day(0), priority: 1 }],
		['Order contact lenses', { plannedDate: day(-1) }],
		['Yoga class', { plannedDate: day(7), plannedTime: '18:00' }]
	],
	lisbon: [
		['Book flights', { status: 'done' }],
		['Find an apartment in Alfama', { status: 'doing', deadline: day(12) }],
		['Day trip to Sintra', { plannedDate: day(18) }],
		['Reserve a table at Taberna da Rua das Flores', { plannedDate: day(17) }],
		['Pack', { plannedDate: day(16) }]
	]
};

const now = Date.now();
const ops = [];
const projectIds = {};
let tick = 0;

const pKeys = generateNKeysBetween(null, null, projects.length);
projects.forEach((p, i) => {
	projectIds[p.key] = crypto.randomUUID();
	ops.push({
		type: 'project.upsert',
		project: {
			id: projectIds[p.key],
			name: p.name,
			color: p.color,
			sortKey: pKeys[i],
			archivedAt: null,
			createdAt: now - 864e5 * 30
		}
	});
});

let rootKeyCursor = null;
function addTasks(items, parentId, projectId) {
	const keys = parentId
		? generateNKeysBetween(null, null, items.length)
		: generateNKeysBetween(rootKeyCursor, null, items.length);
	if (!parentId) rootKeyCursor = keys.at(-1);
	items.forEach(([title, fields = {}, children = []], i) => {
		const id = crypto.randomUUID();
		const created = now - 864e5 * 5 + tick++ * 60_000;
		const status = fields.status ?? 'todo';
		ops.push({
			type: 'task.upsert',
			task: {
				id,
				parentId,
				projectId,
				title,
				notes: '',
				status,
				priority: fields.priority ?? 0,
				plannedDate: fields.plannedDate ?? null,
				plannedTime: fields.plannedTime ?? null,
				deadline: fields.deadline ?? null,
				sortKey: keys[i],
				boardKey: null,
				createdAt: created,
				updatedAt: created,
				completedAt: status === 'done' ? now - 3600_000 * (i + 1) : null
			}
		});
		addTasks(children, id, projectId);
	});
}

for (const [key, items] of Object.entries(tree))
	addTasks(items, null, key === 'inbox' ? null : projectIds[key]);

const res = await fetch(`${BASE}/api/ops`, {
	method: 'POST',
	headers: { 'content-type': 'application/json' },
	body: JSON.stringify({ ops })
});
console.log(res.status, await res.text());
