import type { ToolCatalogEntry, SafetyTier } from "./types";

const monthEnum = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December"
];

const paymentKinds = ["bank", "bkash", "nagad", "rocket", "wise", "payoneer", "paypal", "custom"];

export const TOOLS_CATALOG: ToolCatalogEntry[] = [
	{
		name: "createClient",
		description:
			"Create a new client. Put every field you already know into `data` (name, invoicePrefix, serviceAmount, serviceCurrency, serviceDescription, phone, email, address, year) so the client is fully populated by this single call. Do not leave fields for a later step.",
		safetyTier: "A",
		parameters: {
			type: "object",
			properties: {
				templateId: {
					type: "string",
					description: "Optional ID of an existing client to copy fields from."
				},
				data: {
					type: "object",
					description: "Initial field values for the new client.",
					properties: {
						name: { type: "string" },
						invoicePrefix: { type: "string" },
						phone: { type: "string" },
						email: { type: "string" },
						address: { type: "array", items: { type: "string" } },
						serviceDescription: { type: "string" },
						serviceAmount: { type: "number" },
						serviceCurrency: { type: "string", enum: ["BDT", "USD"] },
						year: { type: "number" }
					}
				}
			}
		}
	},
	{
		name: "updateClient",
		description:
			"Update fields on an existing client. amount/currency/invoicePrefix patches require user confirmation.",
		safetyTier: "A",
		parameters: {
			type: "object",
			properties: {
				clientId: { type: "string", description: "ID of the client to update." },
				patch: {
					type: "object",
					properties: {
						name: { type: "string" },
						invoicePrefix: { type: "string" },
						phone: { type: "string" },
						email: { type: "string" },
						address: { type: "array", items: { type: "string" } },
						serviceDescription: { type: "string" },
						serviceAmount: { type: "number" },
						serviceCurrency: { type: "string", enum: ["BDT", "USD"] },
						year: { type: "number" },
						isActive: { type: "boolean" }
					}
				}
			},
			required: ["clientId", "patch"]
		}
	},
	{
		name: "deleteClient",
		description: "Delete a client and cascade-delete its invoices. Requires confirmation.",
		safetyTier: "B",
		parameters: {
			type: "object",
			properties: { clientId: { type: "string" } },
			required: ["clientId"]
		}
	},
	{
		name: "addInvoiceEntries",
		description:
			"Add one or more invoice entries for a client. Each month becomes its own entry. Sorted by calendar order automatically.",
		safetyTier: "A",
		parameters: {
			type: "object",
			properties: {
				clientId: { type: "string" },
				months: {
					type: "array",
					items: { type: "string", enum: monthEnum },
					minItems: 1,
					maxItems: 24
				}
			},
			required: ["clientId", "months"]
		}
	},
	{
		name: "updateInvoiceEntry",
		description: "Edit fields on an existing invoice entry.",
		safetyTier: "A",
		parameters: {
			type: "object",
			properties: {
				clientId: { type: "string" },
				entryId: { type: "string" },
				patch: {
					type: "object",
					properties: {
						month: { type: "string", enum: monthEnum },
						issueDay: { type: "string" },
						dueDay: { type: "string" },
						isActive: { type: "boolean" }
					}
				}
			},
			required: ["clientId", "entryId", "patch"]
		}
	},
	{
		name: "removeInvoiceEntry",
		description: "Delete a single invoice entry. Requires confirmation.",
		safetyTier: "B",
		parameters: {
			type: "object",
			properties: {
				clientId: { type: "string" },
				entryId: { type: "string" }
			},
			required: ["clientId", "entryId"]
		}
	},
	{
		name: "setClientActive",
		description: "Toggle a client's active state. Inactive clients are excluded from generation.",
		safetyTier: "A",
		parameters: {
			type: "object",
			properties: {
				clientId: { type: "string" },
				isActive: { type: "boolean" }
			},
			required: ["clientId", "isActive"]
		}
	},
	{
		name: "setInvoiceActive",
		description: "Toggle an invoice entry's active state.",
		safetyTier: "A",
		parameters: {
			type: "object",
			properties: {
				clientId: { type: "string" },
				entryId: { type: "string" },
				isActive: { type: "boolean" }
			},
			required: ["clientId", "entryId", "isActive"]
		}
	},
	{
		name: "togglePaymentMethod",
		description: "Attach or detach a payment method on a client.",
		safetyTier: "A",
		parameters: {
			type: "object",
			properties: {
				clientId: { type: "string" },
				paymentMethodId: { type: "string" }
			},
			required: ["clientId", "paymentMethodId"]
		}
	},
	{
		name: "reorderClientPaymentMethods",
		description: "Reorder the payment methods on a client.",
		safetyTier: "A",
		parameters: {
			type: "object",
			properties: {
				clientId: { type: "string" },
				orderedIds: { type: "array", items: { type: "string" } }
			},
			required: ["clientId", "orderedIds"]
		}
	},
	{
		name: "updateFixedField",
		description:
			"Update a sender-display field on the fixed identity. Allowed fields: name, phone, email, address.",
		safetyTier: "A",
		parameters: {
			type: "object",
			properties: {
				field: { type: "string", enum: ["name", "phone", "email", "address"] },
				value: { type: "string" }
			},
			required: ["field", "value"]
		}
	},
	{
		name: "addPaymentMethod",
		description: "Add a new payment method of the given kind (empty fields).",
		safetyTier: "A",
		parameters: {
			type: "object",
			properties: { kind: { type: "string", enum: paymentKinds } },
			required: ["kind"]
		}
	},
	{
		name: "updatePaymentMethodValue",
		description:
			"Update a single value field (account number, link, etc.) on a payment method. Requires confirmation.",
		safetyTier: "B",
		parameters: {
			type: "object",
			properties: {
				paymentMethodId: { type: "string" },
				field: { type: "string", description: "Value key (e.g. 'account', 'link')." },
				value: { type: "string" }
			},
			required: ["paymentMethodId", "field", "value"]
		}
	},
	{
		name: "updatePaymentMethodLabel",
		description: "Update the display label of a payment method.",
		safetyTier: "A",
		parameters: {
			type: "object",
			properties: {
				paymentMethodId: { type: "string" },
				label: { type: "string" }
			},
			required: ["paymentMethodId", "label"]
		}
	},
	{
		name: "removePaymentMethod",
		description: "Delete a payment method. Requires confirmation.",
		safetyTier: "B",
		parameters: {
			type: "object",
			properties: { paymentMethodId: { type: "string" } },
			required: ["paymentMethodId"]
		}
	},
	{
		name: "reorderPaymentMethods",
		description:
			"Reorder the global list of payment methods. Pass every payment method ID in the desired order.",
		safetyTier: "A",
		parameters: {
			type: "object",
			properties: {
				orderedIds: { type: "array", items: { type: "string" } }
			},
			required: ["orderedIds"]
		}
	},
	{
		name: "polishText",
		description:
			"Replace a free-form text field with a rewritten version. Allowed targets: 'clientServiceDescription', 'fromName', 'fromPhone', 'fromEmail', 'fromAddress', 'paymentMethodLabel'. Never use for amounts, currencies, prefixes, or account numbers.",
		safetyTier: "A",
		parameters: {
			type: "object",
			properties: {
				target: {
					type: "string",
					enum: [
						"clientServiceDescription",
						"fromName",
						"fromPhone",
						"fromEmail",
						"fromAddress",
						"paymentMethodLabel"
					]
				},
				clientId: { type: "string" },
				paymentMethodId: { type: "string" },
				proposedText: { type: "string" }
			},
			required: ["target", "proposedText"]
		}
	},
	{
		name: "setSelectedClientId",
		description: "Select which client appears in the preview pane.",
		safetyTier: "A",
		parameters: {
			type: "object",
			properties: { clientId: { type: "string" } },
			required: ["clientId"]
		}
	},
	{
		name: "getAppStateSummary",
		description:
			"Return a concise recap of the current clients, invoices, and payment methods. Read-only — use only when the user explicitly asks for a summary; routine questions are answered directly from CURRENT STATE.",
		safetyTier: "A",
		parameters: {
			type: "object",
			properties: {}
		}
	}
];

export const READ_ONLY_TOOLS = new Set(["getAppStateSummary"]);

export const TIER_MAP: Record<string, SafetyTier> = Object.fromEntries(
	TOOLS_CATALOG.map((t) => [t.name, t.safetyTier])
);

export const TIER_B_PATCH_FIELDS = new Set(["serviceAmount", "serviceCurrency", "invoicePrefix"]);

export const isDemotedToTierB = (toolName: string, args: unknown): boolean => {
	if (toolName === "updateClient" || toolName === "updateInvoiceEntry") {
		const patch = (args as { patch?: Record<string, unknown> })?.patch;
		if (!patch) return false;
		for (const key of Object.keys(patch)) {
			if (TIER_B_PATCH_FIELDS.has(key)) return true;
		}
	}
	return false;
};

export const resolvedTier = (toolName: string, args: unknown): SafetyTier => {
	if (isDemotedToTierB(toolName, args)) return "B";
	return TIER_MAP[toolName] ?? "A";
};
