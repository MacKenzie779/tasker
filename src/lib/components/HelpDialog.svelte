<script lang="ts">
	import { ui } from '#lib/client/ui.svelte.ts';

	const keys: [string, string][] = [
		['n', 'Quick capture (files into the current page)'],
		['Enter', 'Next line'],
		['Tab / Shift+Tab', 'Make subtask / move up a level'],
		['Backspace (empty line)', 'Remove line'],
		['Shift+Enter', 'Open details'],
		['Ctrl/⌘+Enter', 'Toggle done'],
		['Alt+↑ / Alt+↓', 'Move line'],
		['g then i / t / u / c / b', 'Go to Inbox / Today / Upcoming / Calendar / Board'],
		['?', 'This help']
	];
	const tokens: [string, string][] = [
		['fri · tomorrow · next week · 17.10 · in 3 days', 'Planned date (at the end of a line)'],
		['at 10 · 14:00 · 9am', 'Time'],
		['due fri · by 17.10 · bis freitag · ^fri', 'Deadline'],
		['! · !! · !!!', 'Priority low / medium / high'],
		['#project', 'Project (existing, prefix works)'],
		['@fri · @14:00', 'Date / time anywhere in the line']
	];
</script>

{#if ui.helpOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
		role="presentation"
	>
		<button
			type="button"
			class="absolute inset-0 cursor-default"
			onclick={() => (ui.helpOpen = false)}
			aria-label="Close"
			tabindex="-1"
		></button>
		<div
			class="relative max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-zinc-900"
			role="dialog"
			aria-label="Help"
		>
			<h2 class="mb-1 font-semibold">Capturing</h2>
			<p class="mb-3 text-sm text-zinc-500">
				Just type. Enter starts the next task. Everything else is optional and can be done later in
				the details panel.
			</p>
			<table class="mb-5 w-full text-sm">
				<tbody>
					{#each keys as [k, v] (k)}
						<tr class="border-t border-zinc-100 dark:border-zinc-800">
							<td
								class="py-1.5 pr-3 font-mono text-xs whitespace-nowrap text-zinc-600 dark:text-zinc-300"
								>{k}</td
							>
							<td class="py-1.5 text-zinc-600 dark:text-zinc-400">{v}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<h2 class="mb-1 font-semibold">Optional shortcuts while typing</h2>
			<p class="mb-3 text-sm text-zinc-500">
				Applied when you press Enter, removed from the title, and undoable from the message that
				appears.
			</p>
			<table class="w-full text-sm">
				<tbody>
					{#each tokens as [k, v] (k)}
						<tr class="border-t border-zinc-100 dark:border-zinc-800">
							<td class="py-1.5 pr-3 font-mono text-xs text-zinc-600 dark:text-zinc-300">{k}</td>
							<td class="py-1.5 text-zinc-600 dark:text-zinc-400">{v}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}
