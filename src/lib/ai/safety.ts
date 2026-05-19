import type { AppState } from "$lib/server/dto";
import type { Client, MonthName } from "$lib/types";
import { MONTHS } from "$lib/invoice/months";
import type { AnomalyResult, AnomalySettings } from "./types";
import { DEFAULT_ANOMALY_SETTINGS } from "./types";

export type { AnomalyKey, AnomalyResult, AnomalySettings } from "./types";

const VOLUME_SURGE_THRESHOLD = 12;
const STALE_MONTHS_THRESHOLD = 6;
const AMOUNT_OUTLIER_LOW = 0.5;
const AMOUNT_OUTLIER_HIGH = 2;
const AMOUNT_OUTLIER_MIN_SAMPLES = 3;

const findClient = (appState: AppState, clientId: string): Client | undefined =>
	appState.clients.find((c) => c.id === clientId);

const monthsAgo = (month: MonthName, year: number, today: Date): number => {
	const idx = MONTHS.indexOf(month);
	if (idx < 0) return 0;
	const target = new Date(year, idx, 1);
	const reference = new Date(today.getFullYear(), today.getMonth(), 1);
	return (
		(reference.getFullYear() - target.getFullYear()) * 12 +
		(reference.getMonth() - target.getMonth())
	);
};

const rollingMean = (values: number[]): number =>
	values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

interface ToolArgs {
	clientId?: string;
	id?: string;
	months?: MonthName[];
	patch?: { amount?: number; serviceAmount?: number; currency?: string; serviceCurrency?: string };
	amount?: number;
	currency?: string;
	data?: { paymentMethodIds?: string[]; methodIds?: string[] };
}

const detectAmountOutlier = (
	toolName: string,
	args: ToolArgs,
	appState: AppState
): AnomalyResult | null => {
	const clientId = args.clientId ?? args.id;
	if (!clientId) return null;
	const client = findClient(appState, clientId);
	if (!client) return null;

	let proposed: number | undefined;
	if (toolName === "updateClient" || toolName === "updateInvoiceEntry") {
		proposed = args.patch?.amount ?? args.patch?.serviceAmount ?? args.amount;
	}
	if (proposed === undefined) return null;

	const baseline = client.service.amount;
	if (baseline <= 0) return null;
	if (proposed < baseline * AMOUNT_OUTLIER_MIN_SAMPLES) {
		// fallthrough — heuristic compares to baseline directly when single sample
	}

	const samples: number[] = [baseline];
	if (samples.length < AMOUNT_OUTLIER_MIN_SAMPLES) {
		const lo = baseline * AMOUNT_OUTLIER_LOW;
		const hi = baseline * AMOUNT_OUTLIER_HIGH;
		if (proposed < lo || proposed > hi) {
			return {
				key: "AmountOutlier",
				reason: `Proposed amount ${proposed} deviates from ${client.name || "client"}'s usual ${baseline}.`
			};
		}
		return null;
	}

	const mean = rollingMean(samples);
	if (proposed > mean * AMOUNT_OUTLIER_HIGH || proposed < mean * AMOUNT_OUTLIER_LOW) {
		return {
			key: "AmountOutlier",
			reason: `Proposed amount ${proposed} is outside ${AMOUNT_OUTLIER_LOW}×–${AMOUNT_OUTLIER_HIGH}× of the mean (${mean.toFixed(0)}).`
		};
	}
	return null;
};

const detectVolumeSurge = (toolName: string, args: ToolArgs): AnomalyResult | null => {
	if (toolName !== "addInvoiceEntries") return null;
	const count = args.months?.length ?? 0;
	if (count > VOLUME_SURGE_THRESHOLD) {
		return {
			key: "VolumeSurge",
			reason: `Adding ${count} invoice entries in one turn exceeds the safety threshold of ${VOLUME_SURGE_THRESHOLD}.`
		};
	}
	return null;
};

const detectMissingPaymentMethods = (
	toolName: string,
	args: ToolArgs
): AnomalyResult | null => {
	if (toolName !== "createClient") return null;
	const ids = args.data?.paymentMethodIds ?? args.data?.methodIds ?? [];
	if (ids.length === 0) {
		return {
			key: "MissingPaymentMethods",
			reason: "New client has no payment methods selected — invoices will render without payment instructions."
		};
	}
	return null;
};

const detectStalePeriod = (toolName: string, args: ToolArgs, appState: AppState): AnomalyResult | null => {
	if (toolName !== "addInvoiceEntries") return null;
	const months = args.months ?? [];
	if (months.length === 0) return null;
	const clientId = args.clientId;
	if (!clientId) return null;
	const client = findClient(appState, clientId);
	const year = client?.year ?? new Date().getFullYear();
	const now = new Date();
	for (const m of months) {
		if (monthsAgo(m, year, now) > STALE_MONTHS_THRESHOLD) {
			return {
				key: "StalePeriod",
				reason: `Month ${m} ${year} is more than ${STALE_MONTHS_THRESHOLD} months in the past.`
			};
		}
	}
	return null;
};

const detectCurrencyMismatch = (
	toolName: string,
	args: ToolArgs,
	appState: AppState
): AnomalyResult | null => {
	if (toolName !== "updateClient") return null;
	const proposed = args.patch?.currency ?? args.patch?.serviceCurrency;
	if (!proposed) return null;
	const clientId = args.clientId ?? args.id;
	if (!clientId) return null;
	const client = findClient(appState, clientId);
	if (!client) return null;
	if (client.service.currency !== proposed && client.invoices.length > 0) {
		return {
			key: "CurrencyMismatch",
			reason: `Currency change from ${client.service.currency} to ${proposed} — existing entries will remain in ${client.service.currency}.`
		};
	}
	return null;
};

export const detectAnomalies = (
	toolName: string,
	args: unknown,
	appState: AppState,
	settings: AnomalySettings = DEFAULT_ANOMALY_SETTINGS
): AnomalyResult[] => {
	const typed = (args ?? {}) as ToolArgs;
	const out: AnomalyResult[] = [];
	if (settings.amountOutlier) {
		const r = detectAmountOutlier(toolName, typed, appState);
		if (r) out.push(r);
	}
	if (settings.volumeSurge) {
		const r = detectVolumeSurge(toolName, typed);
		if (r) out.push(r);
	}
	if (settings.missingPaymentMethods) {
		const r = detectMissingPaymentMethods(toolName, typed);
		if (r) out.push(r);
	}
	if (settings.stalePeriod) {
		const r = detectStalePeriod(toolName, typed, appState);
		if (r) out.push(r);
	}
	if (settings.currencyMismatch) {
		const r = detectCurrencyMismatch(toolName, typed, appState);
		if (r) out.push(r);
	}
	return out;
};
