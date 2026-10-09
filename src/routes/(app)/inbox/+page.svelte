<script lang="ts">
	import { ui } from '#lib/client/ui.svelte.ts';
	import { counts, filters } from '#lib/client/views.svelte.ts';
	import Outliner from '#lib/components/Outliner.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { isTouch } from '#lib/client/autosize.ts';

	const touch = isTouch();

	ui.useCaptureContext(() => ({ label: 'Inbox', defaults: {} }));
</script>

<svelte:head><title>Inbox · Tasker</title></svelte:head>

<div class="mx-auto max-w-3xl">
	<PageHeader title="Inbox">
		{#snippet actions()}
			{#if counts.inbox}
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
					onclick={() => (ui.triageOpen = true)}
					title="Go through the inbox one task at a time"
				>
					<Icon name="zap" class="size-3.5" /> Process
				</button>
			{/if}
		{/snippet}
	</PageHeader>

	<Outliner
		filter={filters.inbox}
		autofocus="desktop"
		placeholder={touch ? 'Add a task…' : 'Add a task… Enter for the next one, Tab for a subtask'}
	>
		{#snippet empty()}
			<p class="mt-6 px-7 text-sm text-zinc-400">
				Just write it down. Sort it out later — or never.<br />
				<span class="text-xs"
					>Optional while typing: <code>fri</code> <code>!!</code> <code>#project</code>
					<code>due 17.10</code>
					— press <kbd>?</kbd> for more.</span
				>
			</p>
		{/snippet}
	</Outliner>
</div>
