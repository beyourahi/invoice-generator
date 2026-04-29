/// <reference types="@sveltejs/kit" />
/// <reference types="@cloudflare/workers-types" />

import type { CurrentUser } from "$lib/types";
import type { Auth } from "$lib/server/auth";

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
			};
			cf: CfProperties;
			ctx: ExecutionContext;
		}

		interface PageData {
			user: Locals["user"];
			session: Locals["session"];
			currentUser: CurrentUser | null;
		}

		interface Error {
			message: string;
			errorId?: string;
		}
	}
}

export {};
