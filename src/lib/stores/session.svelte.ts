import type { Client, GeneratedInvoice, GenerationState, MonthName } from "$lib/types";
import { MONTHS } from "$lib/invoice/months";

const STORAGE_KEY = "invoice-generator:session";
const SCHEMA_VERSION = 1;

interface PersistedSession {
	version: number;
	clients: Client[];
	selectedClientId: string | null;
	expandedClients: Record<string, boolean>;
}

const createClient = (template?: Client): Client => ({
	id: crypto.randomUUID(),
	name: "",
	invoicePrefix: "",
	phone: "",
	email: "",
	address: [""],
	service: template
		? { ...template.service }
		: {
				description: "",
				amount: 0,
				currency: "BDT"
			},
	payment: template
		? { ...template.payment }
		: {
				method: "bank",
				wiseLink: null
			},
	year: template?.year ?? new Date().getFullYear(),
	invoices: template ? template.invoices.map(e => ({ ...e, id: crypto.randomUUID() })) : []
});

const loadFromStorage = (): PersistedSession | null => {
	if (typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as PersistedSession;
		if (!parsed || parsed.version !== SCHEMA_VERSION) return null;
		return parsed;
	} catch {
		return null;
	}
};

const createSessionStore = () => {
	let clients = $state<Client[]>([]);
	let selectedClientId = $state<string | null>(null);
	let expandedClients = $state<Record<string, boolean>>({});
	let generatedInvoices = $state<GeneratedInvoice[]>([]);
	let generationState = $state<GenerationState>("idle");
	let generationError = $state<string | null>(null);
	let initialized = false;

	const persist = () => {
		if (typeof localStorage === "undefined") return;
		try {
			const payload: PersistedSession = {
				version: SCHEMA_VERSION,
				clients: $state.snapshot(clients) as Client[],
				selectedClientId,
				expandedClients: $state.snapshot(expandedClients) as Record<string, boolean>
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
		} catch {
			// ignore quota or serialization failures so the UI keeps working
		}
	};

	const init = () => {
		if (initialized) return;
		const data = loadFromStorage();
		if (data) {
			clients = data.clients ?? [];
			selectedClientId = data.selectedClientId ?? null;
			expandedClients = data.expandedClients ?? {};
		}
		initialized = true;
	};

	const addClient = () => {
		const template = clients[clients.length - 1];
		const next = createClient(template);
		clients = [...clients, next];
		expandedClients = { ...expandedClients, [next.id]: true };
		persist();
	};

	const removeClient = (id: string) => {
		clients = clients.filter(c => c.id !== id);
		const nextExpanded = { ...expandedClients };
		delete nextExpanded[id];
		expandedClients = nextExpanded;
		if (selectedClientId === id) selectedClientId = null;
		persist();
	};

	const updateClient = (id: string, updater: (c: Client) => Client) => {
		clients = clients.map(c => (c.id === id ? updater(c) : c));
		persist();
	};

	const addInvoiceEntry = (clientId: string) => {
		updateClient(clientId, c => {
			const last = c.invoices[c.invoices.length - 1];
			const nextMonth: MonthName = last
				? MONTHS[(MONTHS.indexOf(last.month) + 1) % MONTHS.length]
				: "January";
			return {
				...c,
				invoices: [
					...c.invoices,
					{
						id: crypto.randomUUID(),
						month: nextMonth,
						issueDay: last?.issueDay ?? "01",
						dueDay: last?.dueDay ?? "07"
					}
				]
			};
		});
	};

	const removeInvoiceEntry = (clientId: string, entryId: string) => {
		updateClient(clientId, c => ({
			...c,
			invoices: c.invoices.filter(e => e.id !== entryId)
		}));
	};

	const updateInvoiceEntry = (
		clientId: string,
		entryId: string,
		field: "month" | "issueDay" | "dueDay",
		value: string
	) => {
		updateClient(clientId, c => ({
			...c,
			invoices: c.invoices.map(e => (e.id === entryId ? { ...e, [field]: value } : e))
		}));
	};

	const setSelectedClientId = (id: string | null) => {
		selectedClientId = id;
		persist();
	};

	const setClientExpanded = (id: string, expanded: boolean) => {
		expandedClients = { ...expandedClients, [id]: expanded };
		persist();
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
		clients.every(c => c.name.trim() !== "" && c.invoicePrefix.trim() !== "")
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
		init,
		addClient,
		removeClient,
		updateClient,
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
