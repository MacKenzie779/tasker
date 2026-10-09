/** Grow a textarea with its content (single visual line by default). */
export function autosize(node: HTMLTextAreaElement, _value?: string) {
	const resize = () => {
		node.style.height = 'auto';
		node.style.height = `${node.scrollHeight}px`;
	};
	// re-measure when the width changes (wrapping), not when our own height change is observed
	let width = 0;
	const ro = new ResizeObserver(([entry]) => {
		if (Math.abs(entry.contentRect.width - width) > 0.5) {
			width = entry.contentRect.width;
			requestAnimationFrame(resize);
		}
	});
	ro.observe(node);
	node.addEventListener('input', resize);
	resize();
	return {
		update: () => queueMicrotask(resize),
		destroy() {
			ro.disconnect();
			node.removeEventListener('input', resize);
		}
	};
}

export const isTouch = () =>
	typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

/** Focus an element once it is in the DOM (the autofocus attribute is ignored for elements added later). */
export function focusOnMount(node: HTMLElement) {
	requestAnimationFrame(() => node.focus());
}
