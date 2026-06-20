import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { requireApiContext } from "$lib/server/api";
import { loadCloudflareConfig, resolveCloudflareCreds } from "$lib/server/ai/cloudflare-config";
import { listChatModels, type CfModel } from "$lib/server/ai/run-rest";
import { describeCloudflareError } from "$lib/server/ai/errors";

/**
 * GET /api/cf/models — the chat (text-generation) Workers AI models on the user's
 * connected Cloudflare account, for the settings model picker. Cached per account
 * for 24h in AI_QUOTA_KV (the only KV binding); `?refresh=1` forces a live re-fetch.
 * When KV is unbound, fetches live every call. Always the user's models, never the owner's.
 *
 * AUTH/ERRORS: 401/503 via requireApiContext. Not-connected → { models: [], connected: false }.
 */
export const GET: RequestHandler = async (event) => {
	const { db, userId } = requireApiContext(event);
	const env = event.platform?.env;

	const cfg = await loadCloudflareConfig(db, userId);
	if (!cfg.accountId) {
		return json({ models: [] as CfModel[], connected: false });
	}

	const kv = env?.AI_QUOTA_KV;
	const cacheKey = `cf-models:${cfg.accountId}`;
	const refresh = event.url.searchParams.get("refresh") === "1";

	if (!refresh && kv) {
		const cached = await kv.get<{ models?: CfModel[] }>(cacheKey, "json");
		if (cached && Array.isArray(cached.models)) {
			return json({ models: cached.models, connected: true, cached: true });
		}
	}

	const resolved = await resolveCloudflareCreds(env?.TOKEN_ENCRYPTION_KEY ?? "", cfg).catch(
		() => null
	);
	if (!resolved) {
		return json({ models: [] as CfModel[], connected: false });
	}

	try {
		const models = await listChatModels(resolved.creds);
		await kv?.put(cacheKey, JSON.stringify({ models, cachedAt: Date.now() }), {
			expirationTtl: 86400
		});
		return json({ models, connected: true, cached: false });
	} catch (e) {
		return json({ models: [] as CfModel[], connected: true, error: describeCloudflareError(e) });
	}
};
