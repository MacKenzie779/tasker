<script lang="ts">
	import { page } from '$app/state';
	import { ui } from '#lib/client/ui.svelte.ts';
	import { counts } from '#lib/client/views.svelte.ts';
	import Icon, { type IconName } from './Icon.svelte';

	const left: { href: string; label: string; icon: IconName; match: string[] }[] = [
		{ href: '/inbox', label: 'Inbox', icon: 'inbox', match: ['/inbox'] },
		{ href: '/today', label: 'Today', icon: 'sun', match: ['/today', '/upcoming'] }
	];
	const right: typeof left = [
		{ href: '/calendar', label: 'Calendar', icon: 'calendar', match: ['/calendar'] },
		{
			href: '/projects',
			label: 'Projects',
			icon: 'folder',
			match: ['/projects', '/board', '/settings']
		}
	];
	const isActive = (m: string[]) => m.some((p) => page.url.pathname.startsWith(p));
</script>

{#snippet item(i: (typeof left)[number], badge?: number)}
	<a
		href={i.href}
		class={[
			'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]',
			isActive(i.match) ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500'
		]}
	>
		<Icon name={i.icon} class="size-5" />
		{i.label}
		{#if badge}<span
				class="absolute top-1 left-1/2 ml-2 rounded-full bg-zinc-200 px-1.5 text-[10px] text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
				>{badge}</span
			>{/if}
	</a>
{/snippet}

<nav
	class="fixed inset-x-0 bottom-0 z-20 flex items-stretch border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:border-zinc-800 dark:bg-zinc-950/95"
>
	{@render item(left[0], counts.inbox)}
	{@render item(left[1], counts.today)}
	<div class="flex flex-1 items-center justify-center">
		<button
			type="button"
			class="-mt-6 flex size-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 active:scale-95"
			onclick={() => ui.openCapture()}
			aria-label="New task"
		>
			<Icon name="plus" class="size-7" />
		</button>
	</div>
	{@render item(right[0])}
	{@render item(right[1])}
</nav>
