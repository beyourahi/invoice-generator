import { defineConfig } from "drizzle-kit";

const hasD1Credentials =
	process.env.CLOUDFLARE_ACCOUNT_ID &&
	process.env.CLOUDFLARE_DATABASE_ID &&
	process.env.CLOUDFLARE_D1_TOKEN;

const baseConfig = {
	out: "./migrations",
	schema: "./src/lib/server/schema.ts",
	dialect: "sqlite" as const,
	verbose: true,
	strict: true,
	breakpoints: true
};

export default defineConfig(
	hasD1Credentials
		? {
				...baseConfig,
				driver: "d1-http",
				dbCredentials: {
					accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
					databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
					token: process.env.CLOUDFLARE_D1_TOKEN!
				}
			}
		: baseConfig
);
