/**
 * Sender identity + payment methods store, synced to D1. Exported as a singleton
 * built by a factory closure: Svelte 5 `$state` reactivity is scoped to its
 * declaration, so the reactive `state` must live inside the factory and be
 * exposed via getters — a module-level `$state` would not be reactive to callers.
 *
 * Mutation contract: every mutation updates local `state` immutably AND persists
 * via the API. Text fields go through debounceSync (trailing-edge, keyed) to
 * coalesce keystrokes; structural changes fire immediately via sync(). hydrate()
 * seeds from server data and is called exactly ONCE in +page.svelte under
 * untrack() — do not add a second hydrate path. The `ai*` methods mutate local
 * state only (the AI tool layer owns the corresponding persistence).
 */
import type { Fixed, PaymentMethodKind, SavedPaymentMethod } from "$lib/types";
import { api, debounceSync, sync } from "$lib/api/client";

const DEFAULT_FIXED: Fixed = {
	from: {
		name: "",
		phone: "",
		email: "",
		address: ""
	},
	paymentMethods: []
};

const TEXT_DEBOUNCE_MS = 400;

const createFixedStore = () => {
	let state = $state<Fixed>(DEFAULT_FIXED);

	const hydrate = (initial: Fixed) => {
		state = initial;
	};

	const updateFrom = (field: keyof Fixed["from"], value: string) => {
		state = { ...state, from: { ...state.from, [field]: value } };
		debounceSync(`fixed:from:${field}`, TEXT_DEBOUNCE_MS, () =>
			api.patch<void>("/api/fixed", { [field]: value })
		);
	};

	const addPaymentMethod = async (kind: PaymentMethodKind): Promise<string | null> => {
		const created = await sync(() =>
			api.post<SavedPaymentMethod>("/api/payment-methods", { kind })
		);
		if (!created) return null;
		state = { ...state, paymentMethods: [...state.paymentMethods, created] };
		return created.id;
	};

	const removePaymentMethod = (id: string) => {
		state = { ...state, paymentMethods: state.paymentMethods.filter((m) => m.id !== id) };
		void sync(() => api.delete<void>(`/api/payment-methods/${id}`));
	};

	const updatePaymentMethodLabel = (id: string, label: string) => {
		state = {
			...state,
			paymentMethods: state.paymentMethods.map((m) => (m.id === id ? { ...m, label } : m))
		};
		debounceSync(`pm:${id}:label`, TEXT_DEBOUNCE_MS, () =>
			api.patch<void>(`/api/payment-methods/${id}`, { label })
		);
	};

	const updatePaymentMethodValue = (id: string, key: string, value: string) => {
		state = {
			...state,
			paymentMethods: state.paymentMethods.map((m) =>
				m.id === id ? { ...m, values: { ...m.values, [key]: value } } : m
			)
		};
		debounceSync(`pm:${id}:value:${key}`, TEXT_DEBOUNCE_MS, () =>
			api.patch<void>(`/api/payment-methods/${id}`, { valueKey: key, valueValue: value })
		);
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
		void sync(() => api.put<void>("/api/payment-methods", { orderedIds: next.map((m) => m.id) }));
	};

	const aiInjectPaymentMethod = (method: SavedPaymentMethod) => {
		const exists = state.paymentMethods.some((m) => m.id === method.id);
		state = {
			...state,
			paymentMethods: exists
				? state.paymentMethods.map((m) => (m.id === method.id ? method : m))
				: [...state.paymentMethods, method]
		};
	};

	const aiApplyPaymentOrder = (orderedIds: string[]) => {
		const byId = new Map(state.paymentMethods.map((m) => [m.id, m]));
		const next: SavedPaymentMethod[] = [];
		for (const id of orderedIds) {
			const method = byId.get(id);
			if (method) next.push(method);
		}
		for (const method of state.paymentMethods) {
			if (!orderedIds.includes(method.id)) next.push(method);
		}
		state = { ...state, paymentMethods: next };
	};

	return {
		get value() {
			return state;
		},
		hydrate,
		updateFrom,
		addPaymentMethod,
		removePaymentMethod,
		updatePaymentMethodLabel,
		updatePaymentMethodValue,
		movePaymentMethod,
		aiInjectPaymentMethod,
		aiApplyPaymentOrder
	};
};

export const fixed = createFixedStore();
