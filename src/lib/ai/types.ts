import type { z } from "zod";

export type SafetyTier = "A" | "B";

export type AnomalyKey =
	| "AmountOutlier"
	| "VolumeSurge"
	| "MissingPaymentMethods"
	| "StalePeriod"
	| "CurrencyMismatch";

export interface AnomalyResult {
	key: AnomalyKey;
	reason: string;
}

export interface AnomalySettings {
	amountOutlier: boolean;
	volumeSurge: boolean;
	missingPaymentMethods: boolean;
	stalePeriod: boolean;
	currencyMismatch: boolean;
}

export const DEFAULT_ANOMALY_SETTINGS: AnomalySettings = {
	amountOutlier: true,
	volumeSurge: true,
	missingPaymentMethods: true,
	stalePeriod: true,
	currencyMismatch: true
};

export interface InverseRecord {
	tool: string;
	args: unknown;
	snapshot?: unknown;
}

export interface ToolCatalogEntry {
	name: string;
	description: string;
	safetyTier: SafetyTier;
	parameters: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
}

export interface ToolDef<Args = unknown, Result = unknown> {
	name: string;
	description: string;
	argSchema: z.ZodType<Args>;
	safetyTier: SafetyTier;
	parameters: ToolCatalogEntry["parameters"];
	humanLabel: (args: Args) => string;
	execute: (args: Args) => Promise<Result>;
	captureInverse: (args: Args, result: Result) => InverseRecord;
}

export type Frame =
	| { t: "text"; delta: string }
	| { t: "tool_call"; id: string; name: string; args: unknown }
	| {
			t: "tool_result";
			id: string;
			status: "applied" | "rejected" | "failed" | "pending_confirmation";
			error?: string;
			actionId?: string;
	  }
	| { t: "anomaly"; toolCallId: string; reasons: string[] }
	| { t: "end"; turnId: string; inputTokens: number; outputTokens: number }
	| { t: "error"; message: string };

export interface ChatRequestBody {
	conversationId: string | null;
	message: string;
}

export interface ParsedToolCall {
	id: string;
	name: string;
	args: unknown;
}

export interface ExecutionRecord {
	toolName: string;
	inputs: unknown;
	inverse: InverseRecord;
	safetyTier: SafetyTier;
	requiredConfirmation: boolean;
	anomalyTriggered: string | null;
	applied: boolean;
	status: "applied" | "rejected" | "failed";
	error: string | null;
}
