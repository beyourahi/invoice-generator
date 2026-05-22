import { browser } from "$app/environment";

const QUERY = "(prefers-reduced-motion: reduce)";

const createReducedMotion = () => {
	let reduced = $state(browser ? window.matchMedia(QUERY).matches : false);

	if (browser) {
		window.matchMedia(QUERY).addEventListener("change", (event) => {
			reduced = event.matches;
		});
	}

	return {
		get current() {
			return reduced;
		}
	};
};

export const prefersReducedMotion = createReducedMotion();
