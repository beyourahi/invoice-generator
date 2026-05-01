export type Currency = "BDT" | "USD";
export type GenerationState = "idle" | "generating" | "done" | "error";

export type PaymentMethodKind =
	| "bank"
	| "bkash"
	| "nagad"
	| "rocket"
	| "wise"
	| "payoneer"
	| "paypal"
	| "custom";

export type PaymentDisplayStyle = "fields" | "link";

export type PaymentFieldType = "text" | "tel" | "email" | "url" | "textarea";

export interface PaymentFieldDef {
	key: string;
	label: string;
	placeholder?: string;
	type?: PaymentFieldType;
	optional?: boolean;
	monospace?: boolean;
}

export interface PaymentMethodDef {
	kind: PaymentMethodKind;
	name: string;
	shortName: string;
	description: string;
	display: PaymentDisplayStyle;
	linkFieldKey?: string;
	linkLabel?: string;
	fields: PaymentFieldDef[];
}

export interface SavedPaymentMethod {
	id: string;
	kind: PaymentMethodKind;
	label: string;
	values: Record<string, string>;
}

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
	methodIds: string[];
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

export interface Fixed {
	from: FixedFrom;
	paymentMethods: SavedPaymentMethod[];
}

export interface GeneratedInvoice {
	clientId: string;
	clientName: string;
	fileName: string;
	invoiceId: string;
	year: number;
	pdfBlob: Blob;
}

export interface CurrentUser {
	name: string;
	email: string;
}

export interface AppConfig {
	name: string;
	description: string;
	url: string;
	author: {
		name: string;
		url: string;
	};
}
