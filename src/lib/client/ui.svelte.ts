import { todayISO } from '#lib/dates.ts';
import type { Task } from '#lib/types.ts';

export interface CaptureContext {
	/** shown as "Adding to …" */
	label: string;
	/** fields every new top-level task gets in this context */
	defaults: Partial<Task>;
}

export interface Toast {
	id: number;
	message: string;
	action?: { label: string; run: () => void };
}

const INBOX: CaptureContext = { label: 'Inbox', defaults: {} };

class UI {
	selectedId = $state<string | null>(null);
	captureOpen = $state(false);
	captureContext = $state<CaptureContext>(INBOX);
	triageOpen = $state(false);
	helpOpen = $state(false);
	/** height of the on-screen keyboard overlapping the layout viewport (mobile) */
	keyboardInset = $state(0);
	today = $state(todayISO());
	toasts = $state<Toast[]>([]);
	private nextToast = 1;

	/** Pages call this so global capture (n / +) files tasks where you are. Returns a cleanup. */
	useCaptureContext(ctx: () => CaptureContext) {
		$effect(() => {
			this.captureContext = ctx();
			return () => (this.captureContext = INBOX);
		});
	}

	/** Open quick capture. On iOS the keyboard only appears if something is focused inside the tap
	 *  handler itself, so focus a throwaway input now and let the capture line take focus over. */
	openCapture() {
		const tmp = document.createElement('input');
		tmp.setAttribute('aria-hidden', 'true');
		tmp.style.cssText = 'position:fixed;top:0;left:0;opacity:0;height:0;font-size:16px;';
		document.body.appendChild(tmp);
		tmp.focus();
		setTimeout(() => tmp.remove(), 1000);
		this.captureOpen = true;
	}

	toast(message: string, action?: Toast['action'], ms = 5000) {
		const id = this.nextToast++;
		this.toasts.push({ id, message, action });
		setTimeout(() => this.dismiss(id), ms);
	}

	dismiss(id: number) {
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}

	start() {
		setInterval(() => {
			const t = todayISO();
			if (t !== this.today) this.today = t;
		}, 60_000);
		const vv = window.visualViewport;
		if (vv) {
			const update = () => {
				this.keyboardInset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
			};
			vv.addEventListener('resize', update);
			vv.addEventListener('scroll', update);
		}
	}
}

export const ui = new UI();
