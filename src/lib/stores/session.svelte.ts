import type { Client, GeneratedInvoice, GenerationState, MonthName } from "$lib/types";
import { MONTHS } from "$lib/invoice/months";

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
	invoices: template
		? template.invoices.map((e) => ({ ...e, id: crypto.randomUUID() }))
		: []
});

const createSessionStore = () => {
	let clients = $state<Client[]>([]);
	let generatedInvoices = $state<GeneratedInvoice[]>([]);
	let generationState = $state<GenerationState>("idle");
	let generationError = $state<string | null>(null);

	const addClient = () => {
		const template = clients[clients.length - 1];
		clients = [...clients, createClient(template)];
	};

	const removeClient = (id: string) => {
		clients = clients.filter((c) => c.id !== id);
	};

	const updateClient = (id: string, updater: (c: Client) => Client) => {
		clients = clients.map((c) => (c.id === id ? updater(c) : c));
	};

	const addInvoiceEntry = (clientId: string) => {
		updateClient(clientId, (c) => {
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
		updateClient(clientId, (c) => ({
			...c,
			invoices: c.invoices.filter((e) => e.id !== entryId)
		}));
	};

	const updateInvoiceEntry = (
		clientId: string,
		entryId: string,
		field: "month" | "issueDay" | "dueDay",
		value: string
	) => {
		updateClient(clientId, (c) => ({
			...c,
			invoices: c.invoices.map((e) => (e.id === entryId ? { ...e, [field]: value } : e))
		}));
	};

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
		addClient,
		removeClient,
		updateClient,
		addInvoiceEntry,
		removeInvoiceEntry,
		updateInvoiceEntry,
		setGenerating,
		setGenerated,
		setError,
		resetGeneration
	};
};

export const session = createSessionStore();
