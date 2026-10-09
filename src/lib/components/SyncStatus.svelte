<script lang="ts">
	import { store } from '#lib/client/store.svelte.ts';
	import Icon from './Icon.svelte';
</script>

{#if store.offline}
	<span
		class="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-amber-600 dark:text-amber-400"
		title="Offline — {store.pending} change(s) will sync when you're back online"
	>
		<Icon name="cloud-off" class="size-3.5" />{store.pending}
	</span>
{:else if store.pending}
	<span class="size-1.5 animate-pulse rounded-full bg-indigo-400" title="Saving…"></span>
{/if}
