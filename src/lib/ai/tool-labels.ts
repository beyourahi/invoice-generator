const TOOL_LABELS: Record<string, string> = {
	createClient: "Create client",
	updateClient: "Update client",
	deleteClient: "Delete client",
	addInvoiceEntries: "Add invoices",
	updateInvoiceEntry: "Update invoice",
	removeInvoiceEntry: "Remove invoice",
	setClientActive: "Toggle client",
	setInvoiceActive: "Toggle invoice",
	togglePaymentMethod: "Update payment methods",
	reorderClientPaymentMethods: "Reorder payment methods",
	updateFixedField: "Update your details",
	addPaymentMethod: "Add payment method",
	updatePaymentMethodValue: "Update payment method",
	updatePaymentMethodLabel: "Rename payment method",
	removePaymentMethod: "Remove payment method",
	reorderPaymentMethods: "Reorder payment methods",
	polishText: "Polish text",
	setSelectedClientId: "Change preview",
	getAppStateSummary: "Summary"
};

export const toolLabel = (name: string): string => TOOL_LABELS[name] ?? "Update";

const FIELD_LABELS: Record<string, string> = {
	name: "name",
	invoicePrefix: "invoice prefix",
	phone: "phone",
	email: "email",
	address: "address",
	serviceDescription: "service description",
	serviceAmount: "amount",
	serviceCurrency: "currency",
	year: "year",
	isActive: "active status",
	month: "month",
	issueDay: "issue day",
	dueDay: "due day"
};

export const fieldLabel = (key: string): string => FIELD_LABELS[key] ?? key;
