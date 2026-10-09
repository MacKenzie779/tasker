<script lang="ts">
	import { ui } from '#lib/client/ui.svelte.ts';
</script>

<div
	class="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"
	aria-live="polite"
>
	{#each ui.toasts as toast (toast.id)}
		<div
			class="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
		>
			<span class="min-w-0 truncate">{toast.message}</span>
			{#if toast.action}
				<button
					type="button"
					class="shrink-0 font-semibold text-indigo-300 hover:text-indigo-200 dark:text-indigo-600"
					onclick={() => {
						toast.action?.run();
						ui.dismiss(toast.id);
					}}>{toast.action.label}</button
				>
			{/if}
		</div>
	{/each}
</div>
