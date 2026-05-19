export interface QuotaResult {
	allowed: boolean;
	count: number;
	limit: number;
	resetsAt: string;
}

const DEFAULT_DAILY_LIMIT = 200;
const DAY_SECONDS = 86400;

const todayKey = (userId: string, now: Date): string => {
	const yyyy = now.getUTCFullYear();
	const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(now.getUTCDate()).padStart(2, "0");
	return `ai:quota:${userId}:${yyyy}-${mm}-${dd}`;
};

const nextUtcMidnight = (now: Date): Date => {
	const next = new Date(now);
	next.setUTCDate(next.getUTCDate() + 1);
	next.setUTCHours(0, 0, 0, 0);
	return next;
};

export const checkAndIncrementQuota = async (
	kv: KVNamespace | undefined,
	userId: string,
	limit: number = DEFAULT_DAILY_LIMIT
): Promise<QuotaResult> => {
	const now = new Date();
	const resetsAt = nextUtcMidnight(now).toISOString();

	if (!kv) {
		return { allowed: true, count: 0, limit, resetsAt };
	}

	const key = todayKey(userId, now);
	const raw = await kv.get(key);
	const current = raw ? parseInt(raw, 10) || 0 : 0;
	if (current >= limit) {
		return { allowed: false, count: current, limit, resetsAt };
	}

	const next = current + 1;
	await kv.put(key, String(next), { expirationTtl: DAY_SECONDS });
	return { allowed: true, count: next, limit, resetsAt };
};

export const getQuotaUsage = async (
	kv: KVNamespace | undefined,
	userId: string,
	limit: number = DEFAULT_DAILY_LIMIT
): Promise<QuotaResult> => {
	const now = new Date();
	const resetsAt = nextUtcMidnight(now).toISOString();
	if (!kv) return { allowed: true, count: 0, limit, resetsAt };
	const key = todayKey(userId, now);
	const raw = await kv.get(key);
	const current = raw ? parseInt(raw, 10) || 0 : 0;
	return { allowed: current < limit, count: current, limit, resetsAt };
};
