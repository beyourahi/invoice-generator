import type { Client, Fixed, InvoiceEntry } from "$lib/types";
import type { Theme } from "$lib/themes/registry";
import { MONTH_TO_NUMBER } from "./months";
import { resolveTokens } from "./resolver";

const CURRENCIES: Record<string, string> = {
	BDT: "৳",
	USD: "$"
};

export const buildInvoiceHtml = (
	client: Client,
	entry: InvoiceEntry,
	fixed: Fixed,
	theme: Theme
): string => {
	const mm = MONTH_TO_NUMBER[entry.month];
	const invoiceId = `${client.invoicePrefix}-${mm}${entry.issueDay}-${client.year}`;
	const symbol = CURRENCIES[client.service.currency] ?? client.service.currency;
	const amount = `${symbol}${client.service.amount.toLocaleString("en-US")}`;
	const description = client.service.description.replace("{MONTH}", entry.month);

	const clientDetails = [
		client.phone ? `<div>${client.phone}</div>` : "",
		client.email ? `<div>${client.email}</div>` : "",
		...client.address.filter(Boolean).map((line) => `<div>${line}</div>`)
	]
		.filter(Boolean)
		.join("");

	const paymentSection =
		client.payment.method === "bank"
			? resolveTokens(theme.bankPayment, {
					BANK_HOLDER: fixed.bank.holder,
					BANK_NAME: fixed.bank.name,
					BANK_ACCOUNT: fixed.bank.account,
					BANK_BRANCH: fixed.bank.branch,
					BANK_ROUTING: fixed.bank.routing
				})
			: resolveTokens(theme.wisePayment, {
					WISE_LINK: client.payment.wiseLink ?? ""
				});

	return resolveTokens(theme.html, {
		INVOICE_ID: invoiceId,
		MONTH: entry.month,
		ISSUE_DAY: entry.issueDay,
		DUE_DAY: entry.dueDay,
		YEAR: String(client.year),
		FROM_NAME: fixed.from.name,
		FROM_PHONE: fixed.from.phone,
		FROM_EMAIL: fixed.from.email,
		FROM_ADDRESS: fixed.from.address,
		CLIENT_NAME: client.name,
		CLIENT_DETAILS: clientDetails,
		DESCRIPTION: description,
		AMOUNT: amount,
		TOTAL: amount,
		CURRENCY: client.service.currency,
		PAYMENT_SECTION: paymentSection,
		CSS: theme.css
	});
};

export const getInvoiceId = (client: Client, entry: InvoiceEntry): string => {
	const mm = MONTH_TO_NUMBER[entry.month];
	return `${client.invoicePrefix}-${mm}${entry.issueDay}-${client.year}`;
};

export const getFileName = (client: Client, entry: InvoiceEntry): string => {
	const mm = MONTH_TO_NUMBER[entry.month];
	return `invoice-${client.invoicePrefix}-${mm}${entry.issueDay}-${client.year}.pdf`;
};

export const getFolderName = (client: Client): string => `${client.name}-${client.year}-Invoices`;
