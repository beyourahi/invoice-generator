import type { Fixed, PaymentMethodKind, SavedPaymentMethod } from "$lib/types";
import { createSavedMethod, getMethodDef } from "$lib/payments/registry";

const STORAGE_KEY = "invoice-generator:fixed";

const DEFAULT_FIXED: Fixed = {
	from: {
		name: "",
		phone: "",
		email: "",
		address: ""
	},
	paymentMethods: []
};

interface LegacyFixed {
	from?: Fixed["from"];
	bank?: {
		holder?: string;
		name?: string;
		account?: string;
		branch?: string;
		routing?: string;
	};
	paymentMethods?: SavedPaymentMethod[];
}

const migrateLegacy = (raw: LegacyFixed): Fixed => {
	const from: Fixed["from"] = {
		name: raw.from?.name ?? "",
		phone: raw.from?.phone ?? "",
		email: raw.from?.email ?? "",
		address: raw.from?.address ?? ""
	};

	if (Array.isArray(raw.paymentMethods)) {
		return { from, paymentMethods: raw.paymentMethods };
	}

	const legacyBank = raw.bank;
	if (legacyBank && Object.values(legacyBank).some((v) => (v ?? "").trim() !== "")) {
		const migrated = createSavedMethod("bank");
		migrated.values = {
			holder: legacyBank.holder ?? "",
			bankName: legacyBank.name ?? "",
			account: legacyBank.account ?? "",
			branch: legacyBank.branch ?? "",
			routing: legacyBank.routing ?? "",
			swift: ""
		};
		return { from, paymentMethods: [migrated] };
	}

	return { from, paymentMethods: [] };
};

const loadFromStorage = (): Fixed => {
	if (typeof localStorage === "undefined") return DEFAULT_FIXED;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULT_FIXED;
		return migrateLegacy(JSON.parse(raw) as LegacyFixed);
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

	const addPaymentMethod = (kind: PaymentMethodKind): string => {
		const method = createSavedMethod(kind);
		const def = getMethodDef(kind);
		const existingCount = state.paymentMethods.filter((m) => m.kind === kind).length;
		method.label = existingCount > 0 ? `${def.name} ${existingCount + 1}` : def.name;
		state = { ...state, paymentMethods: [...state.paymentMethods, method] };
		persist();
		return method.id;
	};

	const removePaymentMethod = (id: string) => {
		state = { ...state, paymentMethods: state.paymentMethods.filter((m) => m.id !== id) };
		persist();
	};

	const updatePaymentMethodLabel = (id: string, label: string) => {
		state = {
			...state,
			paymentMethods: state.paymentMethods.map((m) => (m.id === id ? { ...m, label } : m))
		};
		persist();
	};

	const updatePaymentMethodValue = (id: string, key: string, value: string) => {
		state = {
			...state,
			paymentMethods: state.paymentMethods.map((m) =>
				m.id === id ? { ...m, values: { ...m.values, [key]: value } } : m
			)
		};
		persist();
	};

	const movePaymentMethod = (id: string, direction: -1 | 1) => {
		const list = state.paymentMethods;
		const index = list.findIndex((m) => m.id === id);
		if (index < 0) return;
		const target = index + direction;
		if (target < 0 || target >= list.length) return;
		const next = [...list];
		[next[index], next[target]] = [next[target], next[index]];
		state = { ...state, paymentMethods: next };
		persist();
	};

	return {
		get value() {
			return state;
		},
		init,
		updateFrom,
		addPaymentMethod,
		removePaymentMethod,
		updatePaymentMethodLabel,
		updatePaymentMethodValue,
		movePaymentMethod
	};
};

export const fixed = createFixedStore();
