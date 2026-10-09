import { expect, test, type Page } from '@playwright/test';
import type { AppData, Task } from '../src/lib/types.ts';

const ghost = (page: Page) => page.locator('textarea[data-ghost]').first();

async function serverData(page: Page): Promise<AppData> {
	// wait until the client queue has been flushed to the server
	await expect
		.poll(() =>
			page.evaluate(() => JSON.parse(localStorage.getItem('tasker.queue.v1') ?? '[]').length)
		)
		.toBe(0);
	return (await page.request.get('/api/data')).json();
}

const byTitle = (data: AppData, title: string) => data.tasks.find((t) => t.title === title) as Task;

test('typing a bullet list creates a task tree', async ({ page }) => {
	await page.goto('/inbox');
	await ghost(page).click();
	for (const step of [
		'Trip',
		'Enter',
		'Tab',
		'Flights',
		'Enter',
		'Hotel',
		'Enter',
		'Shift+Tab',
		'Packing',
		'Enter'
	]) {
		if (['Enter', 'Tab', 'Shift+Tab'].includes(step)) await page.keyboard.press(step);
		else await page.keyboard.type(step);
	}
	const data = await serverData(page);
	const trip = byTitle(data, 'Trip');
	expect(byTitle(data, 'Flights').parentId).toBe(trip.id);
	expect(byTitle(data, 'Hotel').parentId).toBe(trip.id);
	expect(byTitle(data, 'Packing').parentId).toBeNull();
	expect(byTitle(data, 'Flights').sortKey < byTitle(data, 'Hotel').sortKey).toBe(true);
});

test('Enter on an existing line inserts a sibling, Tab indents it', async ({ page }) => {
	await page.goto('/inbox');
	await ghost(page).click();
	await page.keyboard.type('Alpha');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Gamma');
	await page.keyboard.press('Enter');
	await page
		.locator('textarea[aria-label="Task"]')
		.nth(await indexOf(page, 'Alpha'))
		.click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Beta');
	await page.keyboard.press('Tab');
	const data = await serverData(page);
	expect(byTitle(data, 'Beta').parentId).toBe(byTitle(data, 'Alpha').id);
});

async function indexOf(page: Page, title: string) {
	const values = await page
		.locator('textarea[aria-label="Task"]')
		.evaluateAll((els) => els.map((e) => (e as HTMLTextAreaElement).value));
	return values.indexOf(title);
}

test('pasting an indented list creates the tree', async ({ page }) => {
	await page.goto('/inbox');
	await ghost(page).click();
	await ghost(page).evaluate((el) => {
		const dt = new DataTransfer();
		dt.setData('text/plain', '- Groceries\n  - Milk\n  - [x] Bread\n- Laundry');
		el.dispatchEvent(
			new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
		);
	});
	const data = await serverData(page);
	const groceries = byTitle(data, 'Groceries');
	expect(byTitle(data, 'Milk').parentId).toBe(groceries.id);
	expect(byTitle(data, 'Bread').status).toBe('done');
	expect(byTitle(data, 'Laundry').parentId).toBeNull();
});

test('inline tokens become fields, with undo', async ({ page }) => {
	await page.goto('/inbox');
	await ghost(page).click();
	await page.keyboard.type('Call dentist tomorrow !!');
	await page.keyboard.press('Enter');
	await expect(page.getByText('“Call dentist” → Tomorrow · !!')).toBeVisible();
	let data = await serverData(page);
	const task = byTitle(data, 'Call dentist');
	expect(task.priority).toBe(2);
	expect(task.plannedDate).not.toBeNull();

	await ghost(page).click();
	await page.keyboard.type('Watch Friday the 13th');
	await page.keyboard.press('Enter');
	data = await serverData(page);
	expect(byTitle(data, 'Watch Friday the 13th').plannedDate).toBeNull();

	await ghost(page).click();
	await page.keyboard.type('Undo me fri');
	await page.keyboard.press('Enter');
	await page.getByRole('button', { name: 'Undo' }).last().click();
	data = await serverData(page);
	expect(byTitle(data, 'Undo me fri').plannedDate).toBeNull();
});

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(from.x + 10, from.y + 10, { steps: 3 });
	await page.mouse.move(to.x, to.y, { steps: 10 });
	await page.mouse.up();
}

const center = async (page: Page, selector: string) => {
	const el = page.locator(selector).first();
	await el.scrollIntoViewIfNeeded();
	const box = (await el.boundingBox())!;
	return { x: box.x + box.width / 2, y: box.y + Math.min(box.height / 2, 20) };
};

test('dragging a card on the board changes its status', async ({ page }) => {
	await page.goto('/inbox');
	await ghost(page).click();
	await page.keyboard.type('Board card');
	await page.keyboard.press('Enter');
	const id = byTitle(await serverData(page), 'Board card').id;

	await page.goto('/board');
	await drag(
		page,
		await center(page, `[data-drag-item="${id}"]`),
		await center(page, '[data-drop="doing"]')
	);
	await expect.poll(async () => byTitle(await serverData(page), 'Board card').status).toBe('doing');
});

test('dragging an unscheduled task onto a calendar day plans it', async ({ page }) => {
	await page.goto('/inbox');
	await ghost(page).click();
	await page.keyboard.type('Calendar drop');
	await page.keyboard.press('Enter');
	const id = byTitle(await serverData(page), 'Calendar drop').id;

	await page.goto('/calendar');
	const day = await page
		.locator('[data-drop]:not([data-drop="unscheduled"])')
		.nth(17)
		.getAttribute('data-drop');
	await drag(
		page,
		await center(page, `[data-drag-item="plan:${id}"]`),
		await center(page, `[data-drop="${day}"]`)
	);
	await expect
		.poll(async () => byTitle(await serverData(page), 'Calendar drop').plannedDate)
		.toBe(day);
});

test('calendar feed serves planned tasks', async ({ page }) => {
	await page.goto('/settings');
	const href = await page.getByRole('link', { name: 'Subscribe' }).first().getAttribute('href');
	const url = new URL(href!.replace(/^webcal:/, 'http:'));
	const res = await page.request.get(url.pathname + url.search);
	expect(res.headers()['content-type']).toContain('text/calendar');
	const body = await res.text();
	expect(body).toContain('BEGIN:VCALENDAR');
	expect(body).toContain('SUMMARY:!! Call dentist');
});
