export type Currency = "BDT" | "USD";
export type PaymentMethod = "bank" | "wise";
export type GenerationState = "idle" | "generating" | "done" | "error";

export type MonthName =
	| "January"
	| "February"
	| "March"
	| "April"
	| "May"
	| "June"
	| "July"
	| "August"
	| "September"
	| "October"
	| "November"
	| "December";

export interface InvoiceEntry {
	id: string;
	month: MonthName;
	issueDay: string;
	dueDay: string;
}

export interface ClientService {
	description: string;
	amount: number;
	currency: Currency;
}

export interface ClientPayment {
	method: PaymentMethod;
	wiseLink: string | null;
}

export interface Client {
	id: string;
	name: string;
	invoicePrefix: string;
	phone: string;
	email: string;
	address: string[];
	service: ClientService;
	payment: ClientPayment;
	year: number;
	invoices: InvoiceEntry[];
}

export interface FixedFrom {
	name: string;
	phone: string;
	email: string;
	address: string;
}

export interface FixedBank {
	holder: string;
	name: string;
	account: string;
	branch: string;
	routing: string;
}

export interface Fixed {
	from: FixedFrom;
	bank: FixedBank;
}

export interface GeneratedInvoice {
	clientName: string;
	fileName: string;
	invoiceId: string;
	year: number;
	pdfBlob: Blob;
}

export interface CurrentUser {
	name: string;
}
