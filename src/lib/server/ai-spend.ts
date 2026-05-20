const MONTH_SECONDS = 31 * 86400;
const DEFAULT_MONTHLY_CAP_USD = 1.0;

const USD_PER_INPUT_TOKEN = 0.29 / 1_000_000;
const USD_PER_OUTPUT_TOKEN = 2.25 / 1_000_000;

const monthKey = (userId: string): string => {
	const now = new Date();
	const yyyy = now.getUTCFullYear();
	const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
	return `ai:spend:${userId}:${yyyy}-${mm}`;
};

const resolveCap = (raw: string | undefined): number => {
	const parsed = raw ? Number(raw) : NaN;
	return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MONTHLY_CAP_USD;
};

export const estimateTurnCostUsd = (inputTokens: number, outputTokens: number): number =>
	inputTokens * USD_PER_INPUT_TOKEN + outputTokens * USD_PER_OUTPUT_TOKEN;

export interface SpendCheck {
	allowed: boolean;
	spentUsd: number;
	capUsd: number;
}

export const checkSpendCap = async (
	kv: KVNamespace | undefined,
	userId: string,
	capRaw: string | undefined
): Promise<SpendCheck> => {
	const capUsd = resolveCap(capRaw);
	if (!kv) return { allowed: true, spentUsd: 0, capUsd };
	const stored = await kv.get(monthKey(userId));
	const spentUsd = stored ? Number(stored) : 0;
	return { allowed: spentUsd < capUsd, spentUsd, capUsd };
};

export const recordSpend = async (
	kv: KVNamespace | undefined,
	userId: string,
	inputTokens: number,
	outputTokens: number
): Promise<void> => {
	if (!kv) return;
	const key = monthKey(userId);
	const stored = await kv.get(key);
	const next = (stored ? Number(stored) : 0) + estimateTurnCostUsd(inputTokens, outputTokens);
	await kv.put(key, next.toFixed(6), { expirationTtl: MONTH_SECONDS });
};
