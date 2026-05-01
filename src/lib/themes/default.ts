import type { Theme } from "./registry";

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice {INVOICE_ID}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>{CSS}</style>
</head>
<body>
<div class="invoice">
<header class="header-section">
<div class="header-meta">
<div class="meta-block">
<div class="meta-label">Invoice No.</div>
<div class="meta-value">{INVOICE_ID}</div>
</div>
<div class="meta-block">
<div class="meta-label">Issued</div>
<div class="meta-value">{MONTH} {ISSUE_DAY}, {YEAR}</div>
</div>
<div class="meta-block">
<div class="meta-label">Due</div>
<div class="meta-value">{MONTH} {DUE_DAY}, {YEAR}</div>
</div>
</div>
<h1 class="invoice-title">Invoice</h1>
</header>
<section class="parties">
<div class="party">
<div class="party-label">From</div>
<div class="party-name">{FROM_NAME}</div>
<div class="party-details">
<div>{FROM_PHONE}</div>
<div>{FROM_EMAIL}</div>
<div>{FROM_ADDRESS}</div>
</div>
</div>
<div class="party">
<div class="party-label">Bill To</div>
<div class="party-name">{CLIENT_NAME}</div>
<div class="party-details">{CLIENT_DETAILS}</div>
</div>
</section>
<section class="items-section">
<div class="items-header">
<span class="items-header-label">Description</span>
<span class="items-header-label items-header-amount">Amount</span>
</div>
<div class="item-row">
<span class="item-description">{DESCRIPTION}</span>
<span class="item-amount">{AMOUNT}</span>
</div>
</section>
<div class="bottom-section">
<section class="payment-section">{PAYMENT_SECTION}</section>
<div class="totals">
<div class="totals-label">Total Due</div>
<div class="totals-value">{TOTAL}</div>
<div class="currency-note">All amounts in {CURRENCY}</div>
</div>
</div>
</div>
</body>
</html>`;

const css = `@page { size: A4; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html { width: 210mm; height: 297mm; background: #fff; }
body {
	width: 210mm;
	height: 297mm;
	font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
	background: #fff;
	color: #000;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
	position: relative;
	overflow: hidden;
}
.invoice {
	width: 100%;
	height: 100%;
	padding: 56px 64px 52px;
	display: flex;
	flex-direction: column;
}

.header-section { margin-bottom: 64px; }
.header-meta {
	display: grid;
	grid-template-columns: 1.4fr 1fr 1fr;
	gap: 32px;
	padding-bottom: 28px;
	border-bottom: 1px solid rgba(0,0,0,0.14);
	margin-bottom: 36px;
}
.meta-block { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.meta-label {
	font-size: 10px;
	font-weight: 500;
	text-transform: uppercase;
	letter-spacing: 0.22em;
	color: rgba(0,0,0,0.55);
}
.meta-value {
	font-size: 14px;
	font-weight: 500;
	letter-spacing: -0.005em;
	color: #000;
	font-feature-settings: "tnum" 1;
	word-break: break-word;
}
.invoice-title {
	font-family: 'Inter Tight', 'Inter', sans-serif;
	font-size: 132px;
	font-weight: 500;
	line-height: 1;
	letter-spacing: -0.05em;
	color: #000;
	margin: 0;
}

.parties {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 56px;
	margin-bottom: 56px;
}
.party { min-width: 0; }
.party-label {
	font-size: 10px;
	font-weight: 500;
	text-transform: uppercase;
	letter-spacing: 0.22em;
	color: rgba(0,0,0,0.55);
	margin-bottom: 16px;
}
.party-name {
	font-size: 22px;
	font-weight: 600;
	letter-spacing: -0.02em;
	margin-bottom: 14px;
	color: #000;
	line-height: 1.2;
}
.party-details {
	font-size: 13px;
	font-weight: 400;
	line-height: 1.7;
	color: rgba(0,0,0,0.72);
}
.party-details > div { word-break: break-word; }

.items-section { margin-bottom: 32px; }
.items-header {
	display: flex;
	justify-content: space-between;
	padding-bottom: 14px;
	border-bottom: 1px solid rgba(0,0,0,0.14);
	margin-bottom: 22px;
}
.items-header-label {
	font-size: 10px;
	font-weight: 500;
	text-transform: uppercase;
	letter-spacing: 0.22em;
	color: rgba(0,0,0,0.55);
}
.item-row {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 32px;
	padding-bottom: 22px;
	border-bottom: 1px solid rgba(0,0,0,0.08);
}
.item-description {
	font-size: 14px;
	font-weight: 400;
	color: #000;
	line-height: 1.55;
	max-width: 70%;
}
.item-amount {
	font-size: 14px;
	font-weight: 500;
	color: #000;
	font-feature-settings: "tnum" 1;
	white-space: nowrap;
}

.bottom-section {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 48px;
	margin-top: auto;
	padding-top: 40px;
	border-top: 1px solid rgba(0,0,0,0.14);
}
.payment-section {
	display: flex;
	flex-direction: column;
	gap: 22px;
	max-width: 380px;
	flex: 1;
	min-width: 0;
}
.payment-block { display: flex; flex-direction: column; }
.payment-label {
	font-size: 10px;
	font-weight: 500;
	text-transform: uppercase;
	letter-spacing: 0.22em;
	color: rgba(0,0,0,0.55);
	margin-bottom: 12px;
}
.payment-fields {
	font-size: 12px;
	font-weight: 400;
	line-height: 1.7;
	color: #000;
}
.payment-fields .payment-field {
	display: flex;
	align-items: baseline;
	gap: 8px;
}
.payment-fields .payment-field-label {
	color: rgba(0,0,0,0.55);
	font-weight: 400;
	min-width: 88px;
	font-size: 11px;
}
.payment-fields .payment-field-value {
	color: #000;
	font-weight: 500;
	word-break: break-word;
}
.payment-fields .payment-field-value.is-mono {
	font-feature-settings: "tnum" 1;
	letter-spacing: 0.01em;
}
.payment-fields .payment-field-value.is-multiline {
	white-space: pre-wrap;
	font-weight: 400;
	line-height: 1.6;
}
.payment-button {
	display: inline-flex;
	align-items: center;
	gap: 10px;
	padding: 12px 22px;
	border: none;
	border-radius: 9999px;
	background: #000;
	color: #fff;
	font-size: 12px;
	font-weight: 500;
	text-decoration: none;
	letter-spacing: 0.01em;
	align-self: flex-start;
}
.payment-button .arrow {
	font-size: 14px;
	line-height: 1;
	color: #fff;
}

.totals {
	text-align: right;
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	flex-shrink: 0;
}
.totals-label {
	font-size: 10px;
	font-weight: 500;
	text-transform: uppercase;
	letter-spacing: 0.22em;
	color: rgba(0,0,0,0.55);
	margin-bottom: 12px;
}
.totals-value {
	font-size: 44px;
	font-weight: 600;
	letter-spacing: -0.025em;
	color: #000;
	line-height: 1;
	margin-bottom: 10px;
	font-feature-settings: "tnum" 1;
}
.currency-note {
	font-size: 11px;
	font-weight: 400;
	color: rgba(0,0,0,0.55);
	letter-spacing: 0.02em;
}

@media print {
	html, body {
		width: 210mm;
		height: 297mm;
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
	}
}`;

export const defaultTheme: Theme = {
	id: "default",
	name: "Classic",
	html,
	css,
	paymentMethodFields: `<div class="payment-block"><div class="payment-label">{METHOD_LABEL}</div><div class="payment-fields">{FIELDS}</div></div>`,
	paymentMethodLink: `<div class="payment-block"><div class="payment-label">{METHOD_LABEL}</div><a href="{LINK_URL}" class="payment-button"><span>{LINK_TEXT}</span><span class="arrow">→</span></a></div>`,
	paymentField: `<div class="payment-field"><span class="payment-field-label">{FIELD_LABEL}</span><span class="payment-field-value{FIELD_VALUE_CLASS}">{FIELD_VALUE}</span></div>`
};
