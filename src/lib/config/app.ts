/**
 * Static app metadata consumed for <title>/<meta> tags. `siblings` are related
 * tools cross-linked in the UI.
 */
import type { AppConfig } from "$lib/types";

export const APP_CONFIG: AppConfig = {
	name: "Invoice Generator",
	description: "Client-side batch invoice PDF generator for recurring billing.",
	url: "https://invoice-generator.beyourahi.workers.dev",
	author: {
		name: "Rahi Khan",
		url: "https://beyourahi.com"
	},
	siblings: [
		{
			name: "Order Processor",
			url: "https://order-processor.beyourahi.workers.dev"
		}
	]
};
