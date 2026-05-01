import type {
	Client,
	Currency,
	GeneratedInvoice,
	GenerationState,
	InvoiceEntry,
	MonthName
} from "$lib/types";
import { api, debounceSync, sync } from "$lib/api/client";

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

	const hydrate = (initial: {
		clients: Client[];
		selectedClientId: string | null;
		expandedClients: Record<string, boolean>;
	}) => {
		clients = initial.clients;
		selectedClientId = initial.selectedClientId;
		expandedClients = initial.expandedClients;
	};

	const addClient = async () => {
		const template = clients[clients.length - 1];
		const created = await sync(() =>
			api.post<Client>("/api/clients", { templateId: template?.id ?? null })
		);
		if (!created) return;
		clients = [...clients, created];
		expandedClients = { ...expandedClients, [created.id]: true };
	};

	const removeClient = (id: string) => {
		clients = clients.filter((c) => c.id !== id);
		const nextExpanded = { ...expandedClients };
		delete nextExpanded[id];
		expandedClients = nextExpanded;
		if (selectedClientId === id) {
			selectedClientId = null;
			void sync(() => api.put<void>("/api/fixed", { selectedClientId: null }));
		}
		void sync(() => api.delete<void>(`/api/clients/${id}`));
	};

	const updateClient = (id: string, patch: ClientPatch) => {
		clients = clients.map((c) => (c.id === id ? applyPatch(c, patch) : c));
		const path = `/api/clients/${id}`;
		const send = () => api.patch<void>(path, patch);
		if (isTextPatch(patch)) {
			debounceSync(`client:${id}`, TEXT_DEBOUNCE_MS, send);
		} else {
			void sync(send);
		}
	};

	const togglePaymentMethod = (clientId: string, methodId: string) => {
		const target = clients.find((c) => c.id === clientId);
		if (!target) return;
		const ids = target.payment.methodIds;
		const next = ids.includes(methodId) ? ids.filter((id) => id !== methodId) : [...ids, methodId];
		clients = clients.map((c) => (c.id === clientId ? { ...c, payment: { methodIds: next } } : c));
		void sync(() => api.put<void>(`/api/clients/${clientId}/payment-methods`, { methodIds: next }));
	};

	const purgePaymentMethodFromClients = (methodId: string) => {
		clients = clients.map((c) => ({
			...c,
			payment: { methodIds: c.payment.methodIds.filter((id) => id !== methodId) }
		}));
	};

	const addInvoiceEntry = async (clientId: string) => {
		const created = await sync(() => api.post<InvoiceEntry>(`/api/clients/${clientId}/entries`));
		if (!created) return;
		clients = clients.map((c) =>
			c.id === clientId ? { ...c, invoices: [...c.invoices, created] } : c
		);
	};

	const removeInvoiceEntry = (clientId: string, entryId: string) => {
		clients = clients.map((c) =>
			c.id === clientId ? { ...c, invoices: c.invoices.filter((e) => e.id !== entryId) } : c
		);
		void sync(() => api.delete<void>(`/api/clients/${clientId}/entries/${entryId}`));
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

	const setSelectedClientId = (id: string | null) => {
		selectedClientId = id;
		void sync(() => api.put<void>("/api/fixed", { selectedClientId: id }));
	};

	const setClientExpanded = (id: string, expanded: boolean) => {
		expandedClients = { ...expandedClients, [id]: expanded };
		void sync(() => api.patch<void>(`/api/clients/${id}`, { expanded }));
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

	const totalInvoiceCount = $derived(clients.reduce((sum, c) => sum + c.invoices.length, 0));
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
		get allClientsValid() {
			return allClientsValid;
		},
		hydrate,
		addClient,
		removeClient,
		updateClient,
		togglePaymentMethod,
		purgePaymentMethodFromClients,
		addInvoiceEntry,
		removeInvoiceEntry,
		updateInvoiceEntry,
		setSelectedClientId,
		setClientExpanded,
		toggleClientExpanded,
		isClientExpanded,
		setGenerating,
		setGenerated,
		setError,
		resetGeneration
	};
};

export const session = createSessionStore();
