import type { OnNavigate } from "@sveltejs/kit";
import { prefersReducedMotion } from "$lib/motion/reduced-motion.svelte";

let navigating = false;

export const isNavigating = (): boolean => navigating;

export const handleViewTransition = (navigation: OnNavigate): Promise<void> | void => {
	navigating = true;

	const supported =
		typeof document !== "undefined" && typeof document.startViewTransition === "function";

	if (!supported || prefersReducedMotion.current) {
		void navigation.complete.finally(() => {
			navigating = false;
		});
		return;
	}

	return new Promise<void>((resolve) => {
		const transition = document.startViewTransition(async () => {
			resolve();
			await navigation.complete;
		});
		void transition.finished.finally(() => {
			navigating = false;
		});
	});
};
