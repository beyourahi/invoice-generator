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
