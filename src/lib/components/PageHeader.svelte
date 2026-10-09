<script lang="ts">
	import type { Snippet } from 'svelte';
	import SyncStatus from './SyncStatus.svelte';

	let {
		title,
		subtitle,
		leading,
		actions,
		children
	}: {
		title?: string;
		subtitle?: string;
		leading?: Snippet;
		actions?: Snippet;
		children?: Snippet;
	} = $props();
</script>

<header
	class="sticky top-0 z-10 -mx-4 mb-3 flex items-center gap-2 border-b border-transparent bg-white/90 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:pt-8 dark:bg-zinc-950/90 lg:dark:bg-transparent"
>
	{@render leading?.()}
	<div class="min-w-0 flex-1">
		{#if children}
			{@render children()}
		{:else}
			<h1 class="truncate text-xl font-bold tracking-tight lg:text-2xl">{title}</h1>
		{/if}
		{#if subtitle}<p class="text-sm text-zinc-500">{subtitle}</p>{/if}
	</div>
	<span class="lg:hidden"><SyncStatus /></span>
	{@render actions?.()}
</header>
