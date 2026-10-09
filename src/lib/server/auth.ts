import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { TASKER_PASSWORD } from '$app/env/private';
import { getSetting, setSetting } from './repo';

export const SESSION_COOKIE = 'tasker_session';
const SESSION_DAYS = 90;

export const authEnabled = () => !!TASKER_PASSWORD;

function secret(): string {
	let s = getSetting('session_secret');
	if (!s) {
		s = randomBytes(32).toString('base64url');
		setSetting('session_secret', s);
	}
	// changing the password invalidates every existing session
	return s + ':' + (TASKER_PASSWORD ?? '');
}

const sign = (payload: string) =>
	createHmac('sha256', secret()).update(payload).digest('base64url');

function safeEqual(a: string, b: string): boolean {
	const ab = Buffer.from(a);
	const bb = Buffer.from(b);
	return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPassword(input: string): boolean {
	if (!TASKER_PASSWORD) return true;
	// compare digests so length differences don't leak through timing
	const h = (s: string) => createHmac('sha256', 'pw').update(s).digest('base64url');
	return safeEqual(h(input), h(TASKER_PASSWORD));
}

export function createSession(cookies: Cookies, secure: boolean) {
	const expires = Date.now() + SESSION_DAYS * 86_400_000;
	const payload = String(expires);
	cookies.set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure,
		maxAge: SESSION_DAYS * 86_400
	});
}

export function isLoggedIn(cookies: Cookies): boolean {
	if (!authEnabled()) return true;
	const value = cookies.get(SESSION_COOKIE);
	if (!value) return false;
	const [payload, signature] = value.split('.');
	if (!payload || !signature || !safeEqual(signature, sign(payload))) return false;
	return Number(payload) > Date.now();
}

export function clearSession(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
