<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { store } from '#lib/client/store.svelte.ts';
	import { ui } from '#lib/client/ui.svelte.ts';
	import Sidebar from '#lib/components/Sidebar.svelte';
	import BottomNav from '#lib/components/BottomNav.svelte';
	import TaskDetail from '#lib/components/TaskDetail.svelte';
	import CaptureModal from '#lib/components/CaptureModal.svelte';
	import Triage from '#lib/components/Triage.svelte';
	import HelpDialog from '#lib/components/HelpDialog.svelte';
	import Toasts from '#lib/components/Toasts.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// svelte-ignore state_referenced_locally
	store.init(data);
	onMount(() => ui.start());

	const GO: Record<string, string> = {
		i: '/inbox',
		t: '/today',
		u: '/upcoming',
		c: '/calendar',
		b: '/board',
		p: '/projects',
		s: '/settings'
	};
	let chord = false;
	let chordTimer: ReturnType<typeof setTimeout>;

	function onKeydown(e: KeyboardEvent) {
		const el = e.target as HTMLElement;
		if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
		if (el.closest('input, textarea, select, [contenteditable="true"]')) return;
		if (ui.captureOpen || ui.triageOpen) return;
		if (chord) {
			chord = false;
			const href = GO[e.key];
			if (href) {
				e.preventDefault();
				goto(href);
			}
			return;
		}
		if (e.key === 'n') {
			e.preventDefault();
			ui.captureOpen = true;
		} else if (e.key === '?') {
			ui.helpOpen = !ui.helpOpen;
		} else if (e.key === 'g') {
			chord = true;
			clearTimeout(chordTimer);
			chordTimer = setTimeout(() => (chord = false), 1200);
		} else if (e.key === 'Escape' && ui.helpOpen) {
			ui.helpOpen = false;
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="min-h-dvh lg:flex">
	<Sidebar />
	<main class={['min-w-0 flex-1 px-4 pb-28 lg:px-10 lg:pb-12', ui.selectedId && 'lg:pr-[28rem]']}>
		{@render children()}
	</main>
</div>
<BottomNav />
<TaskDetail />
<CaptureModal />
<Triage />
<HelpDialog />
<Toasts />
