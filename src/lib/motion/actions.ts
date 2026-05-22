import type { Action } from "svelte/action";
import { getGsap } from "$lib/motion/gsap";
import { prefersReducedMotion } from "$lib/motion/reduced-motion.svelte";
import { DURATION, EASE, DISTANCE } from "$lib/motion/tokens";
import type { DurationToken, DistanceToken } from "$lib/motion/tokens";
import { isNavigating } from "$lib/motion/view-transition";

export interface RevealParams {
	onScroll?: boolean;
	distance?: DistanceToken;
	duration?: DurationToken;
	delay?: number;
}

export const reveal: Action<HTMLElement, RevealParams | undefined> = (node, params) => {
	let cleanup: (() => void) | undefined;
	let cancelled = false;

	if (prefersReducedMotion.current || isNavigating()) {
		return { destroy() {} };
	}

	node.style.opacity = "0";

	const run = async () => {
		const loaded = await getGsap();
		if (cancelled) return;
		if (!loaded) {
			node.style.opacity = "";
			return;
		}

		const distance = DISTANCE[params?.distance ?? "sm"];
		const duration = DURATION[params?.duration ?? "base"];
		const delay = params?.delay ?? 0;

		const vars: Record<string, unknown> = {
			opacity: 1,
			y: 0,
			duration,
			delay,
			ease: EASE.decelerate,
			clearProps: "opacity,transform"
		};
		if (params?.onScroll) {
			vars.scrollTrigger = { trigger: node, start: "top 85%", once: true };
		}

		const tween = loaded.gsap.fromTo(node, { opacity: 0, y: distance }, vars);
		cleanup = () => {
			tween.scrollTrigger?.kill();
			tween.kill();
		};
	};

	void run();

	return {
		destroy() {
			cancelled = true;
			cleanup?.();
		}
	};
};
