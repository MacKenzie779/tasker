<script lang="ts">
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>Sign in · Tasker</title></svelte:head>

<main class="flex min-h-dvh items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
	<form method="POST" class="w-full max-w-xs space-y-4">
		<div class="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
			<img src="/icon.svg" alt="" class="size-7" />
			Tasker
		</div>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			type="password"
			name="password"
			autocomplete="current-password"
			placeholder="Password"
			autofocus
			required
			class="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
		/>
		{#if form?.wrong}<p class="text-sm text-red-600">Wrong password.</p>{/if}
		<button
			class="w-full rounded-lg bg-indigo-600 px-3 py-2 font-medium text-white hover:bg-indigo-500"
		>
			Sign in
		</button>
	</form>
</main>
