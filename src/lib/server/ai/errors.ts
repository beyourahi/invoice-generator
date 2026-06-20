/**
 * User-facing help strings for Cloudflare connection failures. Kept out of the
 * route/UI code so the wording stays consistent across the settings form and the
 * Copilot's "connect your account" gate.
 */

import { CfInferenceError } from "./run-rest";

/** Thrown by the chat endpoint gate when the user has no connected Cloudflare account. */
export class CloudflareNotConnectedError extends Error {
	constructor(message = "Cloudflare account not connected") {
		super(message);
		this.name = "CloudflareNotConnectedError";
	}
}

/** Step-by-step the user can follow to mint the right token. Shown on auth failures. */
export const CF_TOKEN_HELP =
	"Create an API token at dash.cloudflare.com/profile/api-tokens → Create Custom Token, " +
	'with the permission "Account → Workers AI → Read", scoped to your account. ' +
	"Then paste it here along with your Account ID (right sidebar of any account page).";

/** Maps a thrown error to a short, user-readable settings-form message. */
export const describeCloudflareError = (err: unknown): string => {
	if (err instanceof CfInferenceError) {
		switch (err.kind) {
			case "auth":
				return `Token rejected (HTTP ${err.status}). ${CF_TOKEN_HELP}`;
			case "rate_limit":
				return "Cloudflare rate-limited the request (HTTP 429). Try again in a moment.";
			case "model_unavailable":
				return "That model isn't available on your account. Pick another from the list.";
			default:
				return `Couldn't reach Cloudflare (HTTP ${err.status || "network"}). Check your Account ID and try again.`;
		}
	}
	return err instanceof Error ? err.message : "Unknown error validating the Cloudflare connection.";
};
