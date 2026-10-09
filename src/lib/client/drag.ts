// Pointer-based drag & drop that works with mouse and touch (long-press), used by Kanban and Calendar.
//   <div use:draggable={{ id, onDrop }}>   items (also mark with data-drag-item={id} for ordering)
//   <div data-drop="todo">                 drop zones
//   <div data-autoscroll>                  horizontally scrolled container to auto-scroll near edges

export interface DropResult {
	zone: string;
	/** item ids around the insertion point inside the zone (ordering) */
	beforeId: string | null;
	afterId: string | null;
}

export interface DragParams {
	id: string;
	onDrop: (result: DropResult) => void;
	disabled?: boolean;
}

const LONG_PRESS_MS = 250;
const MOVE_THRESHOLD = 6;

export function draggable(node: HTMLElement, initial: DragParams) {
	let params = initial;
	let startX = 0;
	let startY = 0;
	let pointerId = -1;
	let pressTimer: ReturnType<typeof setTimeout> | undefined;
	let active = false;
	let pending = false;
	let ghost: HTMLElement | null = null;
	let indicator: HTMLElement | null = null;
	let zoneEl: HTMLElement | null = null;
	let result: DropResult | null = null;
	let offsetX = 0;
	let offsetY = 0;
	let raf = 0;
	let lastX = 0;
	let lastY = 0;

	node.style.setProperty('-webkit-touch-callout', 'none');

	function onPointerDown(e: PointerEvent) {
		if (params.disabled || e.button !== 0) return;
		if ((e.target as HTMLElement).closest('input, textarea, select, [data-no-drag]')) return;
		pointerId = e.pointerId;
		startX = lastX = e.clientX;
		startY = lastY = e.clientY;
		pending = true;
		if (e.pointerType === 'touch') {
			pressTimer = setTimeout(() => start(), LONG_PRESS_MS);
		}
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);
		window.addEventListener('pointercancel', cancel);
	}

	function onPointerMove(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;
		lastX = e.clientX;
		lastY = e.clientY;
		const moved = Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_THRESHOLD;
		if (pending && !active) {
			if (e.pointerType === 'touch') {
				if (moved) cancel(); // finger moved before long-press: it's a scroll
				return;
			}
			if (moved) start();
			else return;
		}
		if (active) update();
	}

	function start() {
		if (!pending) return;
		active = true;
		const rect = node.getBoundingClientRect();
		offsetX = startX - rect.left;
		offsetY = startY - rect.top;
		ghost = node.cloneNode(true) as HTMLElement;
		Object.assign(ghost.style, {
			position: 'fixed',
			left: '0',
			top: '0',
			width: `${rect.width}px`,
			pointerEvents: 'none',
			zIndex: '100',
			opacity: '0.92',
			transform: `translate(${rect.left}px, ${rect.top}px) rotate(1.5deg)`,
			boxShadow: '0 10px 30px rgba(0,0,0,.18)'
		});
		document.body.appendChild(ghost);
		indicator = document.createElement('div');
		indicator.className = 'drag-indicator';
		document.body.appendChild(indicator);
		node.style.opacity = '0.35';
		document.body.classList.add('dragging');
		document.addEventListener('touchmove', preventScroll, { passive: false });
		navigator.vibrate?.(10);
		update();
		autoScroll();
	}

	function preventScroll(e: TouchEvent) {
		if (active) e.preventDefault();
	}

	function update() {
		if (!ghost) return;
		ghost.style.transform = `translate(${lastX - offsetX}px, ${lastY - offsetY}px) rotate(1.5deg)`;
		const under = document.elementFromPoint(lastX, lastY) as HTMLElement | null;
		const zone = under?.closest<HTMLElement>('[data-drop]') ?? null;
		if (zone !== zoneEl) {
			zoneEl?.classList.remove('drop-active');
			zone?.classList.add('drop-active');
			zoneEl = zone;
		}
		if (!zone) {
			result = null;
			if (indicator) indicator.style.display = 'none';
			return;
		}
		const items = [...zone.querySelectorAll<HTMLElement>('[data-drag-item]')].filter(
			(el) => el.dataset.dragItem !== params.id && el.closest('[data-drop]') === zone
		);
		let index = items.findIndex((el) => {
			const r = el.getBoundingClientRect();
			return lastY < r.top + r.height / 2;
		});
		if (index === -1) index = items.length;
		result = {
			zone: zone.dataset.drop!,
			afterId: items[index - 1]?.dataset.dragItem ?? null,
			beforeId: items[index]?.dataset.dragItem ?? null
		};
		if (indicator) {
			const zr = zone.getBoundingClientRect();
			let y: number;
			if (items[index]) y = items[index].getBoundingClientRect().top - 3;
			else if (items[index - 1]) y = items[index - 1].getBoundingClientRect().bottom + 2;
			else y = zr.top + 4;
			Object.assign(indicator.style, {
				display: zone.dataset.dropIndicator === 'none' ? 'none' : 'block',
				top: `${y}px`,
				left: `${zr.left + 6}px`,
				width: `${zr.width - 12}px`
			});
		}
	}

	function autoScroll() {
		if (!active) return;
		const scroller =
			(zoneEl ?? node).closest<HTMLElement>('[data-autoscroll]') ??
			node.closest<HTMLElement>('[data-autoscroll]');
		if (scroller) {
			const r = scroller.getBoundingClientRect();
			const edge = 48;
			if (lastX < r.left + edge) scroller.scrollLeft -= 14;
			else if (lastX > r.right - edge) scroller.scrollLeft += 14;
		}
		if (lastY < 60) window.scrollBy(0, -12);
		else if (lastY > window.innerHeight - 60) window.scrollBy(0, 12);
		update();
		raf = requestAnimationFrame(autoScroll);
	}

	function onPointerUp(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;
		const dropped = active ? result : null;
		const wasActive = active;
		cleanup();
		if (wasActive) {
			// swallow the click that follows a drag
			const swallow = (ev: Event) => (ev.stopPropagation(), ev.preventDefault());
			window.addEventListener('click', swallow, { capture: true, once: true });
			setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 100);
		}
		if (dropped) params.onDrop(dropped);
	}

	function cancel() {
		cleanup();
	}

	function cleanup() {
		clearTimeout(pressTimer);
		cancelAnimationFrame(raf);
		pending = false;
		active = false;
		ghost?.remove();
		indicator?.remove();
		ghost = indicator = null;
		zoneEl?.classList.remove('drop-active');
		zoneEl = null;
		result = null;
		node.style.opacity = '';
		document.body.classList.remove('dragging');
		document.removeEventListener('touchmove', preventScroll);
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', onPointerUp);
		window.removeEventListener('pointercancel', cancel);
	}

	function onContextMenu(e: Event) {
		if (pending || active) e.preventDefault();
	}

	node.addEventListener('pointerdown', onPointerDown);
	node.addEventListener('contextmenu', onContextMenu);

	return {
		update(next: DragParams) {
			params = next;
		},
		destroy() {
			cleanup();
			node.removeEventListener('pointerdown', onPointerDown);
			node.removeEventListener('contextmenu', onContextMenu);
		}
	};
}
