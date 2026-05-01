import type {
	PaymentFieldDef,
	PaymentMethodDef,
	PaymentMethodKind,
	SavedPaymentMethod
} from "$lib/types";

const bankFields: PaymentFieldDef[] = [
	{ key: "holder", label: "Account holder", placeholder: "e.g., Albus Dumbledore" },
	{ key: "bankName", label: "Bank name", placeholder: "e.g., Gringotts Wizarding Bank" },
	{ key: "account", label: "Account number", placeholder: "0000000000000", monospace: true },
	{ key: "branch", label: "Branch", placeholder: "e.g., Diagon Alley", optional: true },
	{ key: "routing", label: "Routing", placeholder: "000000000", monospace: true, optional: true },
	{ key: "swift", label: "SWIFT / BIC", placeholder: "DBBLBDDH", optional: true, monospace: true }
];

const mobileWalletFields = (provider: string): PaymentFieldDef[] => [
	{ key: "holder", label: "Account holder", placeholder: "e.g., Albus Dumbledore" },
	{
		key: "number",
		label: `${provider} number`,
		placeholder: "01XXXXXXXXX",
		type: "tel",
		monospace: true
	},
	{
		key: "accountType",
		label: "Account type",
		placeholder: "Personal / Merchant / Agent",
		optional: true
	}
];

export const PAYMENT_METHOD_DEFS: Record<PaymentMethodKind, PaymentMethodDef> = {
	bank: {
		kind: "bank",
		name: "Bank transfer",
		shortName: "Bank",
		description: "Wire transfer to a bank account",
		display: "fields",
		fields: bankFields
	},
	bkash: {
		kind: "bkash",
		name: "bKash",
		shortName: "bKash",
		description: "Mobile financial service",
		display: "fields",
		fields: mobileWalletFields("bKash")
	},
	nagad: {
		kind: "nagad",
		name: "Nagad",
		shortName: "Nagad",
		description: "Mobile financial service",
		display: "fields",
		fields: mobileWalletFields("Nagad")
	},
	rocket: {
		kind: "rocket",
		name: "Rocket",
		shortName: "Rocket",
		description: "DBBL mobile banking",
		display: "fields",
		fields: mobileWalletFields("Rocket")
	},
	wise: {
		kind: "wise",
		name: "Wise",
		shortName: "Wise",
		description: "International transfer link",
		display: "link",
		linkFieldKey: "link",
		linkLabel: "Pay with Wise",
		fields: [
			{
				key: "link",
				label: "Wise payment link",
				placeholder: "https://wise.com/pay/...",
				type: "url"
			},
			{
				key: "email",
				label: "Wise email",
				placeholder: "e.g., albus@hogwarts.edu",
				type: "email",
				optional: true
			}
		]
	},
	payoneer: {
		kind: "payoneer",
		name: "Payoneer",
		shortName: "Payoneer",
		description: "Payoneer request link",
		display: "link",
		linkFieldKey: "link",
		linkLabel: "Pay with Payoneer",
		fields: [
			{
				key: "link",
				label: "Payoneer payment link",
				placeholder: "https://payoneer.com/...",
				type: "url"
			},
			{
				key: "email",
				label: "Payoneer email",
				placeholder: "e.g., albus@hogwarts.edu",
				type: "email",
				optional: true
			}
		]
	},
	paypal: {
		kind: "paypal",
		name: "PayPal",
		shortName: "PayPal",
		description: "PayPal payment link",
		display: "link",
		linkFieldKey: "link",
		linkLabel: "Pay with PayPal",
		fields: [
			{
				key: "link",
				label: "PayPal.me link",
				placeholder: "e.g., https://paypal.me/albusdumbledore",
				type: "url"
			},
			{
				key: "email",
				label: "PayPal email",
				placeholder: "e.g., albus@hogwarts.edu",
				type: "email",
				optional: true
			}
		]
	},
	custom: {
		kind: "custom",
		name: "Custom",
		shortName: "Custom",
		description: "Any other payment method",
		display: "fields",
		fields: [
			{
				key: "details",
				label: "Payment details",
				placeholder: "e.g., Owl post galleons to Hogwarts",
				type: "textarea"
			}
		]
	}
};

export const PAYMENT_METHOD_KINDS = Object.keys(PAYMENT_METHOD_DEFS) as PaymentMethodKind[];

export const getMethodDef = (kind: PaymentMethodKind): PaymentMethodDef =>
	PAYMENT_METHOD_DEFS[kind];

export const createSavedMethod = (kind: PaymentMethodKind): SavedPaymentMethod => {
	const def = getMethodDef(kind);
	const values: Record<string, string> = {};
	for (const field of def.fields) {
		values[field.key] = "";
	}
	return {
		id: crypto.randomUUID(),
		kind,
		label: def.name,
		values
	};
};

export const isMethodComplete = (method: SavedPaymentMethod): boolean => {
	const def = getMethodDef(method.kind);
	return def.fields.every((field) => {
		if (field.optional) return true;
		const value = method.values[field.key]?.trim() ?? "";
		return value.length > 0;
	});
};
