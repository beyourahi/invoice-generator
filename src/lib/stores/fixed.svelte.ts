import type { Fixed } from "$lib/types";

const STORAGE_KEY = "invoice-generator:fixed";

const DEFAULT_FIXED: Fixed = {
	from: {
		name: "",
		phone: "",
		email: "",
		address: ""
	},
	bank: {
		holder: "",
		name: "",
		account: "",
		branch: "",
		routing: ""
	}
};

const loadFromStorage = (): Fixed => {
	if (typeof localStorage === "undefined") return DEFAULT_FIXED;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULT_FIXED;
		return JSON.parse(raw) as Fixed;
	} catch {
		return DEFAULT_FIXED;
	}
};

const createFixedStore = () => {
	let state = $state<Fixed>(DEFAULT_FIXED);
	let initialized = false;

	const init = () => {
		if (initialized) return;
		state = loadFromStorage();
		initialized = true;
	};

	const persist = () => {
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		}
	};

	const updateFrom = (field: keyof Fixed["from"], value: string) => {
		state = { ...state, from: { ...state.from, [field]: value } };
		persist();
	};

	const updateBank = (field: keyof Fixed["bank"], value: string) => {
		state = { ...state, bank: { ...state.bank, [field]: value } };
		persist();
	};

	return {
		get value() {
			return state;
		},
		init,
		updateFrom,
		updateBank
	};
};

export const fixed = createFixedStore();
