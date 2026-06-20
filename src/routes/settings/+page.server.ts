import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { eq } from "drizzle-orm";

import { getDatabase, schema } from "$lib/server/db";
import { deriveTokenKey, encryptToken, decryptToken, maskToken } from "$lib/server/crypto";
import {
	listChatModels,
	DEFAULT_MODEL,
	type CfModel,
	type CloudflareCreds
} from "$lib/server/ai/run-rest";
import { describeCloudflareError } from "$lib/server/ai/errors";

/**
 * Settings page server module — the BYO Cloudflare connection for the AI Copilot.
 *   load → redirects guests to /login; decrypts the stored token to return ONLY
 *          `maskToken(plain)` (the raw secret never leaves the server) plus the
 *          connection state and cached chat models.
 *   save → validates a newly-supplied token by LISTING MODELS on the user's account
 *          (proves token + account + permission), encrypts + upserts on success,
 *          and warms the KV model cache. An empty token preserves the existing blob.
 *   reset → DELETE FROM user_settings (does NOT cascade to clients/invoices).
 *
 * INVARIANT: this module is the only place that calls `decryptToken` on a settings load.
 */
export const load: PageServerLoad = async ({ locals, platform }) => {
	const userId = locals.user?.id;
	if (!userId) throw redirect(303, "/login");

	const db = platform?.env?.DB ? getDatabase(platform.env.DB) : null;
	if (!db) {
		return {
			connected: false,
			accountId: "",
			maskedToken: "",
			model: DEFAULT_MODEL,
			models: [] as CfModel[]
		};
	}

	const rows = await db
		.select()
		.from(schema.userSettings)
		.where(eq(schema.userSettings.userId, userId))
		.limit(1);
	const row = rows[0];

	let maskedToken = "";
	if (row?.cloudflareTokenEncrypted && platform?.env?.TOKEN_ENCRYPTION_KEY) {
		try {
			const key = await deriveTokenKey(platform.env.TOKEN_ENCRYPTION_KEY);
			maskedToken = maskToken(
				await decryptToken(new Uint8Array(row.cloudflareTokenEncrypted as ArrayBuffer), key)
			);
		} catch {
			maskedToken = "(decrypt error)";
		}
	}

	// Serve the picker from the per-account KV cache when present (live refresh is the
	// Refresh button's job via /api/cf/models?refresh=1).
	let models: CfModel[] = [];
	if (row?.cloudflareAccountId && platform?.env?.AI_QUOTA_KV) {
		const cached = await platform.env.AI_QUOTA_KV.get<{ models?: CfModel[] }>(
			`cf-models:${row.cloudflareAccountId}`,
			"json"
		);
		if (cached && Array.isArray(cached.models)) models = cached.models;
	}

	return {
		connected: Boolean(row?.cloudflareTokenEncrypted && row?.cloudflareAccountId),
		accountId: row?.cloudflareAccountId ?? "",
		maskedToken,
		model: row?.cloudflareModel ?? DEFAULT_MODEL,
		models
	};
};

export const actions: Actions = {
	save: async ({ request, locals, platform }) => {
		const userId = locals.user?.id;
		if (!userId) throw redirect(303, "/login");
		const env = platform?.env;
		if (!env?.DB) return fail(503, { error: "Database unavailable" });
		if (!env.TOKEN_ENCRYPTION_KEY) {
			return fail(500, { error: "Server is missing TOKEN_ENCRYPTION_KEY." });
		}

		const form = await request.formData();
		const newToken = (form.get("cloudflareToken") as string | null)?.trim() ?? "";
		const accountId = (form.get("cloudflareAccountId") as string | null)?.trim() ?? "";
		const model = (form.get("cloudflareModel") as string | null)?.trim() || DEFAULT_MODEL;

		if (!accountId) {
			return fail(400, { error: "Account ID is required to connect your Cloudflare account." });
		}

		const db = getDatabase(env.DB);
		const existing = (
			await db
				.select()
				.from(schema.userSettings)
				.where(eq(schema.userSettings.userId, userId))
				.limit(1)
		)[0];

		const key = await deriveTokenKey(env.TOKEN_ENCRYPTION_KEY);

		// Resolve the plaintext token: a newly-supplied one (must be validated) or the
		// already-stored one (re-saving with a different account id / model).
		let plainToken: string | null = null;
		let tokenBlob: Uint8Array | null = existing?.cloudflareTokenEncrypted
			? new Uint8Array(existing.cloudflareTokenEncrypted as ArrayBuffer)
			: null;
		if (newToken) {
			plainToken = newToken;
		} else if (tokenBlob) {
			try {
				plainToken = await decryptToken(tokenBlob, key);
			} catch {
				plainToken = null;
			}
		}

		if (!plainToken) {
			return fail(400, {
				error: "Paste your Cloudflare API token to connect — it can't be left blank on first save."
			});
		}

		// Validate the connection by listing models on the user's account. This proves
		// the token + account id + Workers AI permission are all correct before we store.
		const creds: CloudflareCreds = { accountId, apiToken: plainToken };
		let models: CfModel[];
		try {
			models = await listChatModels(creds);
		} catch (e) {
			return fail(400, { error: describeCloudflareError(e), accountId, model });
		}

		if (newToken) {
			tokenBlob = await encryptToken(newToken, key);
		}

		const values = {
			userId,
			cloudflareTokenEncrypted: tokenBlob,
			cloudflareAccountId: accountId,
			cloudflareModel: model
		};
		await db
			.insert(schema.userSettings)
			.values(values)
			.onConflictDoUpdate({
				target: schema.userSettings.userId,
				set: {
					cloudflareTokenEncrypted: values.cloudflareTokenEncrypted,
					cloudflareAccountId: values.cloudflareAccountId,
					cloudflareModel: values.cloudflareModel
				}
			});

		// Warm the picker cache so the page reflects the validated list immediately.
		await env.AI_QUOTA_KV?.put(
			`cf-models:${accountId}`,
			JSON.stringify({ models, cachedAt: Date.now() }),
			{ expirationTtl: 86400 }
		);

		return { success: true, message: "Cloudflare account connected." };
	},

	reset: async ({ locals, platform }) => {
		const userId = locals.user?.id;
		if (!userId) throw redirect(303, "/login");
		if (!platform?.env?.DB) return fail(503, { error: "Database unavailable" });

		const db = getDatabase(platform.env.DB);
		await db.delete(schema.userSettings).where(eq(schema.userSettings.userId, userId));
		return { success: true, message: "Cloudflare connection removed." };
	}
};
