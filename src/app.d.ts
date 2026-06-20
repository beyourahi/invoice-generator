/// <reference types="@sveltejs/kit" />
/// <reference types="@cloudflare/workers-types" />

import type { CurrentUser } from "$lib/types";
import type { Auth } from "$lib/server/auth";

/**
 * SvelteKit App namespace augmentation.
 * - Locals: populated per-request by hooks.server.ts (null when unauthenticated/D1 absent).
 * - Platform.env: the Cloudflare Worker bindings (see wrangler.jsonc). Optional members
 *   (AI_QUOTA_KV, AI_*, SEED_SECRET, E2E_BYPASS_AUTH) degrade gracefully when unset;
 *   DB/AI/VECTORIZE are required at runtime for auth + AI Copilot. TOKEN_ENCRYPTION_KEY
 *   (secret) is required for the BYO Cloudflare connection (token encryption + the Copilot).
 * - PageData.aiEnabled: feature flag derived from AI_COPILOT_ENABLED in +layout.server.ts.
 * - Error.errorId: UUID correlation id surfaced by both handleError hooks.
 */
declare global {
	namespace App {
		interface Locals {
			user: Auth["$Infer"]["Session"]["user"] | null;
			session: Auth["$Infer"]["Session"]["session"] | null;
			currentUser: CurrentUser | null;
		}

		interface Platform {
			env: {
				DB: D1Database;
				BETTER_AUTH_SECRET: string;
				BETTER_AUTH_URL: string;
				GOOGLE_CLIENT_ID: string;
				GOOGLE_CLIENT_SECRET: string;
				AI: Ai;
				VECTORIZE: VectorizeIndex;
				TOKEN_ENCRYPTION_KEY?: string;
				AI_QUOTA_KV?: KVNamespace;
				AI_COPILOT_ENABLED?: string;
				AI_MONTHLY_CAP_USD?: string;
				SEED_SECRET?: string;
				E2E_BYPASS_AUTH?: string;
			};
			cf: CfProperties;
			ctx: ExecutionContext;
		}

		interface PageData {
			user: Locals["user"];
			session: Locals["session"];
			currentUser: CurrentUser | null;
			aiEnabled?: boolean;
		}

		interface Error {
			message: string;
			errorId?: string;
		}
	}
}

export {};
