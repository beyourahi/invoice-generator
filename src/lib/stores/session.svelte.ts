/**
 * Per-session client/invoice/generation store, synced to D1. Singleton built by
 * a factory closure (Svelte 5 `$state` is declaration-scoped, so reactive fields
 * must live inside the factory and be exposed via getters).
 *
 * Persistence: mutations update local `$state` immutably and persist via the API
 * — text edits through keyed debounceSync, structural changes immediately via
 * sync(). hydrate() runs exactly ONCE in +page.svelte under untrack(); do not add
 * a second hydrate path. `ai*` methods mutate local state only.
 *
 * Derived: totalInvoiceCount (raw), generatableInvoiceCount (after the active
 * AND gate via active.ts), allClientsValid (every client has non-blank name AND
 * invoicePrefix — this gates the generate button).
 *
 * expandedClients defaults to EXPANDED when a key is absent (see isClientExpanded
 * / toggleClientExpanded `?? true`); only an explicit false collapses a card.
 */
import type {
	Client,
	Currency,
	GeneratedInvoice,
	GenerationState,
	InvoiceEntry,
	MonthName
} from "$lib/types";
import { SvelteMap } from "svelte/reactivity";
import { api, debounceSync, sync } from "$lib/api/client";
import { MONTHS } from "$lib/invoice/months";
import { countGeneratableInvoices } from "$lib/invoice/active";
import { readLocal, writeLocal } from "$lib/persistence/local";
import { GUEST_SESSION_KEY, type GuestSessionSnapshot } from "$lib/persistence/keys";

const currentYear = () => new Date().getFullYear();

const TEXT_DEBOUNCE_MS = 400;

export interface ClientPatch {
	name?: string;
	invoicePrefix?: string;
	phone?: string;
	email?: string;
	address?: string[];
	serviceDescription?: string;
	serviceAmount?: number;
	serviceCurrency?: Currency;
	year?: number;
	expanded?: boolean;
}

const TEXT_PATCH_KEYS = new Set<keyof ClientPatch>([
	"name",
	"invoicePrefix",
	"phone",
	"email",
	"address",
	"serviceDescription"
]);

const applyPatch = (client: Client, patch: ClientPatch): Client => {
	const next: Client = { ...client };
	if (patch.name !== undefined) next.name = patch.name;
	if (patch.invoicePrefix !== undefined) next.invoicePrefix = patch.invoicePrefix;
	if (patch.phone !== undefined) next.phone = patch.phone;
	if (patch.email !== undefined) next.email = patch.email;
	if (patch.address !== undefined) next.address = patch.address;
	if (
		patch.serviceDescription !== undefined ||
		patch.serviceAmount !== undefined ||
		patch.serviceCurrency !== undefined
	) {
		next.service = {
			...client.service,
			...(patch.serviceDescription !== undefined ? { description: patch.serviceDescription } : {}),
			...(patch.serviceAmount !== undefined ? { amount: patch.serviceAmount } : {}),
			...(patch.serviceCurrency !== undefined ? { currency: patch.serviceCurrency } : {})
		};
	}
	if (patch.year !== undefined) next.year = patch.year;
	return next;
};

const isTextPatch = (patch: ClientPatch): boolean =>
	Object.keys(patch).some((k) => TEXT_PATCH_KEYS.has(k as keyof ClientPatch));

const createSessionStore = () => {
	let clients = $state<Client[]>([]);
	let selectedClientId = $state<string | null>(null);
	let expandedClients = $state<Record<string, boolean>>({});
	let generatedInvoices = $state<GeneratedInvoice[]>([]);
	let generationState = $state<GenerationState>("idle");
	let generationError = $state<string | null>(null);
	// Set once at hydration. Authed → mutations persist to D1 (cross-device).
	// Guest → mutations persist to localStorage, and creates (client/entry) mint
	// their own ids/positions client-side (no server round-trip).
	let authed = false;

	const saveLocal = () =>
		writeLocal<GuestSessionSnapshot>(GUEST_SESSION_KEY, {
			clients,
			selectedClientId,
			expandedClients
		});

	// For structural (non-text) mutations: persist to D1 when authed, else mirror
	// the whole guest snapshot to localStorage.
	const persist = (thunk: () => Promise<unknown>) => {
		if (authed) void sync(thunk);
		else saveLocal();
	};

	const hydrate = (
		initial: {
			clients: Client[];
			selectedClientId: string | null;
			expandedClients: Record<string, boolean>;
		},
		opts?: { authed?: boolean }
	) => {
		clients = initial.clients;
		selectedClientId = initial.selectedClientId;
		expandedClients = initial.expandedClients;
		authed = opts?.authed ?? false;
	};

	// Browser-only: re-seed the guest board from localStorage after mount (SSR
	// can't read it). Additive over the empty server state, so the single-untrack-
	// site invariant for authed data stays intact.
	const loadGuest = () => {
		const guest = readLocal<GuestSessionSnapshot>(GUEST_SESSION_KEY);
		if (guest) {
			clients = guest.clients;
			selectedClientId = guest.selectedClientId;
			expandedClients = guest.expandedClients;
		}
	};

	// New clients are seeded from the most recent client as a template, so repeated
	// adds inherit the last-used config. Authed: the server clones (templateId).
	// Guest: mirror that cloning client-side — IDENTITY fields (name/prefix/phone/
	// email/address) always start blank; service config, year, payment-method links
	// and entry month/day shapes carry over (see server createClient).
	const addClient = async () => {
		const template = clients[clients.length - 1];
		if (authed) {
			const created = await sync(() =>
				api.post<Client>("/api/clients", { templateId: template?.id ?? null })
			);
			if (!created) return;
			clients = [...clients, created];
			expandedClients = { ...expandedClients, [created.id]: true };
			return;
		}
		const id = crypto.randomUUID();
		const created: Client = {
			id,
			name: "",
			invoicePrefix: "",
			phone: "",
			email: "",
			address: [""],
			service: {
				description: template?.service.description ?? "",
				amount: template?.service.amount ?? 0,
				currency: template?.service.currency ?? "BDT"
			},
			payment: { methodIds: template ? [...template.payment.methodIds] : [] },
			year: template?.year ?? currentYear(),
			isActive: true,
			invoices: (template?.invoices ?? []).map((e) => ({
				id: crypto.randomUUID(),
				month: e.month,
				issueDay: e.issueDay,
				dueDay: e.dueDay,
				isActive: true
			})),
			createdAt: new Date().toISOString()
		};
		clients = [...clients, created];
		expandedClients = { ...expandedClients, [id]: true };
		saveLocal();
	};

	const removeClient = (id: string) => {
		clients = clients.filter((c) => c.id !== id);
		const nextExpanded = { ...expandedClients };
		delete nextExpanded[id];
		expandedClients = nextExpanded;
		if (selectedClientId === id) {
			selectedClientId = null;
			if (authed) void sync(() => api.put<void>("/api/fixed", { selectedClientId: null }));
		}
		persist(() => api.delete<void>(`/api/clients/${id}`));
	};

	// Write buffer accumulating in-flight text patches per client so the single
	// per-client debounce coalesces them into ONE PATCH carrying every edited
	// field. Previously each scheduled save captured only the latest field's patch
	// and the same-key reschedule cancelled the prior timer, silently dropping
	// earlier fields from D1 (local $state still looked saved). updateInvoiceEntry
	// sidesteps this with per-field keys, but a ClientPatch can carry many fields
	// at once (AI's fillRemainingFields), so we merge instead of keying per field.
	// Entry is read+cleared at fire time. SvelteMap (not a plain Map) only to
	// satisfy svelte/prefer-svelte-reactivity; nothing reads it reactively.
	const pendingClientPatches = new SvelteMap<string, ClientPatch>();

	const updateClient = (id: string, patch: ClientPatch) => {
		clients = clients.map((c) => (c.id === id ? applyPatch(c, patch) : c));
		if (!authed) {
			saveLocal();
			return;
		}
		const path = `/api/clients/${id}`;
		if (isTextPatch(patch)) {
			pendingClientPatches.set(id, { ...pendingClientPatches.get(id), ...patch });
			debounceSync(`client:${id}`, TEXT_DEBOUNCE_MS, () => {
				const merged = pendingClientPatches.get(id) ?? patch;
				pendingClientPatches.delete(id);
				return api.patch<void>(path, merged);
			});
		} else {
			void sync(() => api.patch<void>(path, patch));
		}
	};

	const togglePaymentMethod = (clientId: string, methodId: string) => {
		const target = clients.find((c) => c.id === clientId);
		if (!target) return;
		const ids = target.payment.methodIds;
		const next = ids.includes(methodId) ? ids.filter((id) => id !== methodId) : [...ids, methodId];
		clients = clients.map((c) => (c.id === clientId ? { ...c, payment: { methodIds: next } } : c));
		persist(() => api.put<void>(`/api/clients/${clientId}/payment-methods`, { methodIds: next }));
	};

	const ensurePaymentMethodSelected = (clientId: string, methodId: string) => {
		const target = clients.find((c) => c.id === clientId);
		if (!target) return;
		if (target.payment.methodIds.includes(methodId)) return;
		const next = [...target.payment.methodIds, methodId];
		clients = clients.map((c) => (c.id === clientId ? { ...c, payment: { methodIds: next } } : c));
		persist(() => api.put<void>(`/api/clients/${clientId}/payment-methods`, { methodIds: next }));
	};

	// Local-only (the DB FK cascade covers the server side); mirror for guests.
	const purgePaymentMethodFromClients = (methodId: string) => {
		clients = clients.map((c) => ({
			...c,
			payment: { methodIds: c.payment.methodIds.filter((id) => id !== methodId) }
		}));
		if (!authed) saveLocal();
	};

	// Builds a guest entry mirroring the server default: month defaults to the one
	// AFTER the last entry (wrapping Dec→Jan) or January; issue/due days inherit.
	const buildGuestEntry = (clientId: string, month?: MonthName): InvoiceEntry | null => {
		const client = clients.find((c) => c.id === clientId);
		if (!client) return null;
		const last = client.invoices[client.invoices.length - 1];
		const nextMonth: MonthName =
			month ?? (last ? MONTHS[(MONTHS.indexOf(last.month) + 1) % MONTHS.length] : "January");
		return {
			id: crypto.randomUUID(),
			month: nextMonth,
			issueDay: last?.issueDay ?? "01",
			dueDay: last?.dueDay ?? "07",
			isActive: true
		};
	};

	const addInvoiceEntry = async (clientId: string) => {
		if (authed) {
			const created = await sync(() => api.post<InvoiceEntry>(`/api/clients/${clientId}/entries`));
			if (!created) return;
			clients = clients.map((c) =>
				c.id === clientId ? { ...c, invoices: [...c.invoices, created] } : c
			);
			return;
		}
		const created = buildGuestEntry(clientId);
		if (!created) return;
		clients = clients.map((c) =>
			c.id === clientId ? { ...c, invoices: [...c.invoices, created] } : c
		);
		saveLocal();
	};

	// Persists each month sequentially (one POST per entry) in calendar order.
	const addInvoiceEntries = async (clientId: string, months: MonthName[]) => {
		const sorted = [...months].sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));
		for (const month of sorted) {
			if (authed) {
				const created = await sync(() =>
					api.post<InvoiceEntry>(`/api/clients/${clientId}/entries`, { month })
				);
				if (!created) continue;
				clients = clients.map((c) =>
					c.id === clientId ? { ...c, invoices: [...c.invoices, created] } : c
				);
			} else {
				const created = buildGuestEntry(clientId, month);
				if (!created) continue;
				clients = clients.map((c) =>
					c.id === clientId ? { ...c, invoices: [...c.invoices, created] } : c
				);
			}
		}
		if (!authed) saveLocal();
	};

	const removeInvoiceEntry = (clientId: string, entryId: string) => {
		clients = clients.map((c) =>
			c.id === clientId ? { ...c, invoices: c.invoices.filter((e) => e.id !== entryId) } : c
		);
		persist(() => api.delete<void>(`/api/clients/${clientId}/entries/${entryId}`));
	};

	const updateInvoiceEntry = (
		clientId: string,
		entryId: string,
		field: "month" | "issueDay" | "dueDay",
		value: string
	) => {
		clients = clients.map((c) =>
			c.id === clientId
				? {
						...c,
						invoices: c.invoices.map((e) => (e.id === entryId ? { ...e, [field]: value } : e))
					}
				: c
		);
		if (!authed) {
			saveLocal();
			return;
		}
		const body =
			field === "month"
				? { month: value as MonthName }
				: field === "issueDay"
					? { issueDay: value }
					: { dueDay: value };
		const path = `/api/clients/${clientId}/entries/${entryId}`;
		if (field === "month") {
			void sync(() => api.patch<void>(path, body));
		} else {
			debounceSync(`entry:${entryId}:${field}`, TEXT_DEBOUNCE_MS, () =>
				api.patch<void>(path, body)
			);
		}
	};

	// OPTIMISTIC UPDATE WITH ROLLBACK (the contract — no separate "saving" flag):
	// mutate locally, persist, and on API failure (sync → null) restore the prior
	// isActive so a stale flag can't leak into the generation queue (active.ts).
	const setClientActive = async (id: string, isActive: boolean) => {
		const current = clients.find((c) => c.id === id);
		if (!current || current.isActive === isActive) return;
		clients = clients.map((c) => (c.id === id ? { ...c, isActive } : c));
		if (!authed) {
			saveLocal();
			return;
		}
		const result = await sync(() => api.patch<void>(`/api/clients/${id}`, { isActive }));
		if (result === null) {
			clients = clients.map((c) => (c.id === id ? { ...c, isActive: !isActive } : c));
		}
	};

	// Same optimistic-update-with-rollback contract as setClientActive.
	const setInvoiceActive = async (clientId: string, entryId: string, isActive: boolean) => {
		const client = clients.find((c) => c.id === clientId);
		const entry = client?.invoices.find((e) => e.id === entryId);
		if (!entry || entry.isActive === isActive) return;
		clients = clients.map((c) =>
			c.id === clientId
				? { ...c, invoices: c.invoices.map((e) => (e.id === entryId ? { ...e, isActive } : e)) }
				: c
		);
		if (!authed) {
			saveLocal();
			return;
		}
		const result = await sync(() =>
			api.patch<void>(`/api/clients/${clientId}/entries/${entryId}`, { isActive })
		);
		if (result === null) {
			clients = clients.map((c) =>
				c.id === clientId
					? {
							...c,
							invoices: c.invoices.map((e) =>
								e.id === entryId ? { ...e, isActive: !isActive } : e
							)
						}
					: c
			);
		}
	};

	const setSelectedClientId = (id: string | null) => {
		selectedClientId = id;
		persist(() => api.put<void>("/api/fixed", { selectedClientId: id }));
	};

	const setClientExpanded = (id: string, expanded: boolean) => {
		expandedClients = { ...expandedClients, [id]: expanded };
		persist(() => api.patch<void>(`/api/clients/${id}`, { expanded }));
	};

	const toggleClientExpanded = (id: string) => {
		const current = expandedClients[id] ?? true;
		setClientExpanded(id, !current);
	};

	const isClientExpanded = (id: string): boolean => expandedClients[id] ?? true;

	const setGenerating = () => {
		generationState = "generating";
		generationError = null;
		generatedInvoices = [];
	};

	const setGenerated = (invoices: GeneratedInvoice[]) => {
		generatedInvoices = invoices;
		generationState = "done";
	};

	const setError = (message: string) => {
		generationState = "error";
		generationError = message;
	};

	const resetGeneration = () => {
		generationState = "idle";
		generatedInvoices = [];
		generationError = null;
	};

	const aiInjectClient = (client: Client) => {
		const exists = clients.some((c) => c.id === client.id);
		clients = exists ? clients.map((c) => (c.id === client.id ? client : c)) : [...clients, client];
		expandedClients = { ...expandedClients, [client.id]: true };
	};

	const aiAppendEntry = (clientId: string, entry: InvoiceEntry) => {
		clients = clients.map((c) =>
			c.id === clientId ? { ...c, invoices: [...c.invoices, entry] } : c
		);
	};

	const aiApplyPaymentOrder = (clientId: string, methodIds: string[]) => {
		clients = clients.map((c) =>
			c.id === clientId ? { ...c, payment: { methodIds: [...methodIds] } } : c
		);
	};

	const aiRestoreClient = (snapshot: Client) => {
		clients = [...clients, snapshot];
		expandedClients = { ...expandedClients, [snapshot.id]: true };
	};

	const totalInvoiceCount = $derived(clients.reduce((sum, c) => sum + c.invoices.length, 0));
	const generatableInvoiceCount = $derived(countGeneratableInvoices(clients));
	const allClientsValid = $derived(
		clients.every((c) => c.name.trim() !== "" && c.invoicePrefix.trim() !== "")
	);

	return {
		get clients() {
			return clients;
		},
		get selectedClientId() {
			return selectedClientId;
		},
		get generatedInvoices() {
			return generatedInvoices;
		},
		get generationState() {
			return generationState;
		},
		get generationError() {
			return generationError;
		},
		get totalInvoiceCount() {
			return totalInvoiceCount;
		},
		get generatableInvoiceCount() {
			return generatableInvoiceCount;
		},
		get allClientsValid() {
			return allClientsValid;
		},
		hydrate,
		loadGuest,
		addClient,
		removeClient,
		updateClient,
		setClientActive,
		setInvoiceActive,
		togglePaymentMethod,
		ensurePaymentMethodSelected,
		purgePaymentMethodFromClients,
		addInvoiceEntry,
		addInvoiceEntries,
		removeInvoiceEntry,
		updateInvoiceEntry,
		setSelectedClientId,
		setClientExpanded,
		toggleClientExpanded,
		isClientExpanded,
		setGenerating,
		setGenerated,
		setError,
		resetGeneration,
		aiInjectClient,
		aiAppendEntry,
		aiApplyPaymentOrder,
		aiRestoreClient
	};
};

export const session = createSessionStore();
