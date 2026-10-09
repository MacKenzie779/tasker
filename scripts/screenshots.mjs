// Captures the README screenshots from a running instance seeded with scripts/seed-demo.mjs.
// Usage: node scripts/screenshots.mjs [base-url]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:5174';
const OUT = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });

const data = await (await fetch(`${BASE}/api/data`)).json();
const project = (name) => data.projects.find((p) => p.name === name).id;

const browser = await chromium.launch();

async function shot(name, path, { mobile = false, dark = false, setup } = {}) {
	const context = await browser.newContext({
		viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 860 },
		deviceScaleFactor: 2,
		colorScheme: dark ? 'dark' : 'light',
		hasTouch: mobile,
		isMobile: mobile
	});
	const page = await context.newPage();
	await page.goto(BASE + path);
	await page.locator('main').waitFor();
	await page.waitForTimeout(400);
	if (setup) await setup(page);
	await page.waitForTimeout(300);
	await page.screenshot({ path: `${OUT}/${name}.png` });
	await context.close();
	console.log('saved', name);
}

const typeInCapture = (text) => async (page) => {
	const ghost = page.locator('textarea[data-ghost]').first();
	await ghost.click();
	await page.keyboard.type(text);
};

await shot('inbox', '/inbox', { setup: typeInCapture('Water the herbs tomorrow !!') });
await shot('today', '/today', {
	setup: async (page) => {
		await page.evaluate(() => document.activeElement?.blur());
		await page.getByRole('button', { name: 'Open details' }).nth(1).click();
	}
});
await shot('project', `/projects/${project('Work')}`, {
	dark: true,
	setup: async (page) => {
		await page.evaluate(() => document.activeElement?.blur());
	}
});
await shot('board', `/projects/${project('Work')}?view=board`);
await shot('calendar', '/calendar');

await shot('mobile-inbox', '/inbox', { mobile: true });
await shot('mobile-capture', `/projects/${project('Home')}`, {
	mobile: true,
	setup: async (page) => {
		await page.getByRole('button', { name: 'New task' }).click();
		await page.keyboard.type('Buy new light bulbs');
		await page.keyboard.press('Enter');
		await page.keyboard.type('Living room');
		await page.keyboard.press('Tab');
		await page.waitForTimeout(5500); // let the toast fade
	}
});
await shot('mobile-calendar', '/calendar', { mobile: true, dark: true });

await browser.close();
