<!-- Global quick capture (n on desktop, + on mobile). Files tasks into the context of the current page. -->
<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { ui } from '#lib/client/ui.svelte.ts';
	import Outliner from './Outliner.svelte';

	const created = new SvelteSet<string>();

	function close() {
		ui.captureOpen = false;
		created.clear();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			(document.activeElement as HTMLElement | null)?.blur();
			close();
		}
	}
</script>

{#if ui.captureOpen}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-start sm:pt-[12vh]"
		role="presentation"
	>
		<button
			type="button"
			class="absolute inset-0 cursor-default"
			onclick={close}
			aria-label="Close"
			tabindex="-1"
		></button>
		<div
			class="relative w-full max-w-xl rounded-t-2xl bg-white p-4 shadow-2xl pointer-coarse:pb-20 sm:rounded-2xl dark:bg-zinc-900"
			style:margin-bottom="{ui.keyboardInset}px"
			role="dialog"
			aria-modal="true"
			aria-label="Quick capture"
			tabindex="-1"
			onkeydown={onKeydown}
		>
			<div class="mb-2 flex items-center justify-between text-xs text-zinc-500">
				<span
					>Adding to <strong class="font-medium text-zinc-700 dark:text-zinc-300"
						>{ui.captureContext.label}</strong
					></span
				>
				<button
					type="button"
					class="rounded-md px-2 py-1 font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
					onclick={close}
				>
					Done
				</button>
			</div>
			<Outliner
				filter={(t) => created.has(t.id)}
				defaults={() => ui.captureContext.defaults}
				onCreated={(t) => created.add(t.id)}
				showProject
				autofocus
				placeholder="What do you need to do?"
			/>
			<p class="mt-3 hidden text-xs text-zinc-400 sm:block">
				Enter next line · Tab subtask · Esc close — optional: <code>fri</code> <code>!!</code>
				<code>#project</code> <code>due 17.10</code>
			</p>
		</div>
	</div>
{/if}
