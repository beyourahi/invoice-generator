import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

interface AuthEnv {
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
}

export const createAuth = (d1: D1Database, env: AuthEnv) => {
	const db = drizzle(d1, { schema });

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "sqlite",
			usePlural: true,
			schema
		}),
		baseURL: env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET,
		emailAndPassword: {
			enabled: false
		},
		socialProviders: {
			google: {
				clientId: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET
			}
		},
		session: {
			expiresIn: 60 * 60 * 24 * 7,
			updateAge: 60 * 60 * 24,
			cookieCache: {
				enabled: true,
				maxAge: 60 * 5,
				version: "1"
			}
		},
		rateLimit: {
			enabled: true,
			window: 60,
			max: 20,
			storage: "database"
		},
		advanced: {
			cookiePrefix: "invoice-generator",
			useSecureCookies: true
		},
		trustedOrigins: [
			"http://localhost:5173",
			"http://localhost:8787",
			"https://invoice-generator.beyourahi.workers.dev"
		]
	});
};

export type Auth = ReturnType<typeof createAuth>;
