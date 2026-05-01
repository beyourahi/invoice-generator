import type { Client, Fixed, InvoiceEntry, SavedPaymentMethod } from "$lib/types";
import type { Theme } from "$lib/themes/registry";
import { getMethodDef } from "$lib/payments/registry";
import { MONTH_TO_NUMBER } from "./months";
import { resolveTokens } from "./resolver";

const CURRENCIES: Record<string, string> = {
	BDT: "৳",
	USD: "$"
};

const escapeHtml = (value: string): string =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");

const renderPaymentMethod = (method: SavedPaymentMethod, theme: Theme): string => {
	const def = getMethodDef(method.kind);
	const label = escapeHtml(method.label.trim() || def.name);

	if (def.display === "link" && def.linkFieldKey) {
		const url = method.values[def.linkFieldKey]?.trim() ?? "";
		if (!url) return "";
		return resolveTokens(theme.paymentMethodLink, {
			METHOD_LABEL: label,
			LINK_URL: escapeHtml(url),
			LINK_TEXT: escapeHtml(def.linkLabel ?? "Pay")
		});
	}

	const fields = def.fields
		.map((field) => {
			const raw = method.values[field.key]?.trim() ?? "";
			if (!raw) return "";
			const isMultiline = field.type === "textarea";
			const valueClass = [
				field.monospace ? " is-mono" : "",
				isMultiline ? " is-multiline" : ""
			].join("");
			return resolveTokens(theme.paymentField, {
				FIELD_LABEL: escapeHtml(field.label),
				FIELD_VALUE: escapeHtml(raw),
				FIELD_VALUE_CLASS: valueClass
			});
		})
		.filter(Boolean)
		.join("");

	if (!fields) return "";

	return resolveTokens(theme.paymentMethodFields, {
		METHOD_LABEL: label,
		FIELDS: fields
	});
};

const renderPaymentSection = (client: Client, fixed: Fixed, theme: Theme): string => {
	const methodsById = new Map(fixed.paymentMethods.map((m) => [m.id, m]));
	return client.payment.methodIds
		.map((id) => methodsById.get(id))
		.filter((m): m is SavedPaymentMethod => Boolean(m))
		.map((m) => renderPaymentMethod(m, theme))
		.filter(Boolean)
		.join("");
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
		client.phone ? `<div>${escapeHtml(client.phone)}</div>` : "",
		client.email ? `<div>${escapeHtml(client.email)}</div>` : "",
		...client.address.filter(Boolean).map((line) => `<div>${escapeHtml(line)}</div>`)
	]
		.filter(Boolean)
		.join("");

	const paymentSection = renderPaymentSection(client, fixed, theme);

	return resolveTokens(theme.html, {
		INVOICE_ID: invoiceId,
		MONTH: entry.month,
		ISSUE_DAY: entry.issueDay,
		DUE_DAY: entry.dueDay,
		YEAR: String(client.year),
		FROM_NAME: escapeHtml(fixed.from.name),
		FROM_PHONE: escapeHtml(fixed.from.phone),
		FROM_EMAIL: escapeHtml(fixed.from.email),
		FROM_ADDRESS: escapeHtml(fixed.from.address),
		CLIENT_NAME: escapeHtml(client.name),
		CLIENT_DETAILS: clientDetails,
		DESCRIPTION: escapeHtml(description),
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
