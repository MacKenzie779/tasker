<script lang="ts">
	import { page } from '$app/state';

	const tabs = [
		{ href: '/today', label: 'Today' },
		{ href: '/upcoming', label: 'Upcoming' }
	];
</script>

<nav class="flex gap-1 rounded-lg bg-zinc-100 p-1 text-sm lg:hidden dark:bg-zinc-900">
	{#each tabs as t (t.href)}
		<a
			href={t.href}
			class={[
				'rounded-md px-3 py-1 font-medium',
				page.url.pathname === t.href ? 'bg-white shadow-sm dark:bg-zinc-700' : 'text-zinc-500'
			]}>{t.label}</a
		>
	{/each}
</nav>
