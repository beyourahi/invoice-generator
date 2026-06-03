/**
 * Static app-help passages embedded into the VECTORIZE index by POST /api/ai/seed,
 * then retrieved per-turn by retrieveAppKnowledge to ground "how do I…" questions.
 * COUPLING: re-seed the index whenever this corpus changes, or RAG serves stale text.
 * @see ./rag.ts, ./embeddings.ts
 */

export interface KnowledgeChunk {
	id: string;
	text: string;
}

export const KNOWLEDGE_CORPUS: KnowledgeChunk[] = [
	{
		id: "kb-overview",
		text: "The invoice generator lets a single freelancer configure a fixed sender identity and payment methods, add multiple clients with service details, queue invoice entries across one or many months, and bulk-generate PDF invoices. The AI Copilot can drive the same client and invoice operations through natural language."
	},
	{
		id: "kb-payment-methods",
		text: "Supported payment method types are bank transfer, bKash, Nagad, Rocket, Wise, Payoneer, PayPal, and custom. Wise, Payoneer, and PayPal render as a payment link button on the invoice; bank, bKash, Nagad, Rocket, and custom render as labeled key-value field rows."
	},
	{
		id: "kb-currencies",
		text: "Two currencies are supported: BDT (Bangladeshi Taka) and USD (US Dollar). Each client's service amount has its own currency. Currency and amount changes require confirmation in the UI."
	},
	{
		id: "kb-invoice-id",
		text: "Invoice IDs follow the format PREFIX-MMDD-YEAR, where PREFIX is the client's invoice prefix, MM is the month number, DD is the issue day, and YEAR is the client's year. Example: ACME-0101-2026. Service descriptions can include a {MONTH} token that is substituted per invoice."
	},
	{
		id: "kb-add-months",
		text: "To queue invoices for several months at once, open a client and use the month picker to select multiple months. Each selected month becomes a separate invoice entry. The Copilot can add many months in one command, for example queueing January through June for a client."
	},
	{
		id: "kb-onboarding",
		text: "New clients can be onboarded by pasting a contract, email, or prior invoice into the Copilot, which extracts the client name, service description, amount, currency, and invoice prefix and creates the client in one step. Always confirm extracted amounts before generating invoices."
	},
	{
		id: "kb-active-filter",
		text: "An invoice is only generated when both its client is active and the entry itself is active. Deactivating a client cascades to all its entries. Use the active toggles to exclude specific clients or months from a generation run without deleting them."
	},
	{
		id: "kb-generation",
		text: "PDF generation runs entirely in the browser, one invoice at a time. Generated PDFs can be saved to a chosen folder via the directory picker, downloaded individually, or packaged into a single ZIP. The generate action is disabled until every client has a name and an invoice prefix."
	},
	{
		id: "kb-copilot-scope",
		text: "The AI Copilot accelerates three tasks: queueing recurring invoice entries, onboarding new clients from pasted text, and polishing free-form text such as service descriptions or the sender bio. It cannot change amounts, currency, invoice prefixes, or payment-method account numbers without an explicit confirmation."
	},
	{
		id: "kb-copilot-safety",
		text: "Destructive or money-related Copilot actions — deleting records, changing a payment-method value, or changing an amount or currency — are intercepted by the UI for confirmation before they apply. Every applied Copilot action can be undone."
	},
	{
		id: "kb-sender-identity",
		text: "The sender identity (the freelancer's own name, phone, email, and address) is configured once in the fixed sender panel and appears on every invoice. To change sender details through the Copilot, ask it to update the sender field — it does not create a client for this."
	},
	{
		id: "kb-vision",
		text: "The Copilot accepts image uploads. You can attach a screenshot of a contract, a prior invoice, or a payment receipt, and the Copilot reads it to extract client details, amounts, or service descriptions. Images are processed alongside your text message."
	},
	{
		id: "kb-language",
		text: "The Copilot understands and replies in both English and Bangla. If you write in Bangla, it answers in Bangla while keeping client names, amounts, currency codes, and identifiers unchanged."
	}
];
