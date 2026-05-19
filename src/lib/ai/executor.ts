import { api } from "$lib/api/client";
import type { AppState } from "$lib/server/dto";
import { session } from "$lib/stores/session.svelte";
import { fixed } from "$lib/stores/fixed.svelte";
import { argSchemas, executors, type ArgsOf } from "./tools";
import { detectAnomalies } from "./safety";
import { resolvedTier, TIER_MAP } from "./tools-catalog";
import type {
	AnomalyResult,
	AnomalySettings,
	Frame,
	InverseRecord,
	ParsedToolCall,
	SafetyTier
} from "./types";

export interface ExecutionContext {
	conversationId: string | null;
	messageId: string | null;
	anomalySettings: AnomalySettings;
	requestConfirmation: (req: ConfirmationRequest) => Promise<boolean>;
	onResult: (result: ExecutionFrame) => void;
}

export interface ConfirmationRequest {
	toolCallId: string;
	toolName: string;
	args: unknown;
	tier: SafetyTier;
	anomalies: AnomalyResult[];
	humanLabel: string;
}

export type ExecutionFrame = Frame & { t: "tool_result" | "anomaly" };

export interface ExecutionOutcome {
	toolCallId: string;
	toolName: string;
	status: "applied" | "rejected" | "failed";
	actionId: string | null;
	error: string | null;
}

const snapshotAppState = (): AppState => ({
	fixed: fixed.value,
	clients: session.clients,
	selectedClientId: session.selectedClientId,
	expandedClients: {}
});

const humanLabelFor = (toolName: string, args: unknown): string => {
	const a = (args ?? {}) as Record<string, unknown>;
	switch (toolName) {
		case "deleteClient": {
			const c = session.clients.find((x) => x.id === a.clientId);
			return `Delete client "${c?.name || a.clientId}" and all its invoices`;
		}
		case "removeInvoiceEntry": {
			const c = session.clients.find((x) => x.id === a.clientId);
			const e = c?.invoices.find((x) => x.id === a.entryId);
			return `Delete the ${e?.month || ""} invoice for "${c?.name || a.clientId}"`;
		}
		case "removePaymentMethod": {
			const m = fixed.value.paymentMethods.find((x) => x.id === a.paymentMethodId);
			return `Delete payment method "${m?.label || m?.kind || a.paymentMethodId}"`;
		}
		case "updatePaymentMethodValue":
			return `Update payment method ${a.field} value`;
		case "updateClient": {
			const c = session.clients.find((x) => x.id === a.clientId);
			const patch = (a.patch as Record<string, unknown>) ?? {};
			const keys = Object.keys(patch).join(", ");
			return `Update ${keys} on client "${c?.name || a.clientId}"`;
		}
		case "updateInvoiceEntry": {
			const c = session.clients.find((x) => x.id === a.clientId);
			const e = c?.invoices.find((x) => x.id === a.entryId);
			const patch = (a.patch as Record<string, unknown>) ?? {};
			const keys = Object.keys(patch).join(", ");
			return `Update ${keys} on the ${e?.month || ""} invoice for "${c?.name || a.clientId}"`;
		}
		default:
			return toolName;
	}
};

const recordAction = async (params: {
	conversationId: string | null;
	messageId: string | null;
	toolName: string;
	inputs: unknown;
	inverse: InverseRecord;
	safetyTier: SafetyTier;
	requiredConfirmation: boolean;
	anomalies: AnomalyResult[];
	applied: boolean;
	status: "applied" | "rejected" | "failed";
	error: string | null;
}): Promise<string | null> => {
	try {
		const created = await api.post<{ id: string }>("/api/ai/actions", {
			conversationId: params.conversationId,
			messageId: params.messageId,
			toolName: params.toolName,
			inputs: params.inputs,
			inverse: params.inverse,
			safetyTier: params.safetyTier,
			requiredConfirmation: params.requiredConfirmation,
			anomalyTriggered:
				params.anomalies.length > 0 ? params.anomalies.map((a) => a.key).join(",") : null,
			applied: params.applied,
			status: params.status,
			error: params.error
		});
		return created.id;
	} catch (err) {
		console.error("[ai-executor] failed to record action", err);
		return null;
	}
};

const isKnownTool = (name: string): name is keyof typeof argSchemas => name in argSchemas;

export const executeToolCall = async (
	call: ParsedToolCall,
	ctx: ExecutionContext
): Promise<ExecutionOutcome> => {
	if (!isKnownTool(call.name)) {
		const outcome: ExecutionOutcome = {
			toolCallId: call.id,
			toolName: call.name,
			status: "failed",
			actionId: null,
			error: `Unknown tool: ${call.name}`
		};
		ctx.onResult({
			t: "tool_result",
			id: call.id,
			status: "failed",
			error: outcome.error ?? undefined
		});
		return outcome;
	}

	const schema = argSchemas[call.name];
	const parsed = schema.safeParse(call.args ?? {});
	if (!parsed.success) {
		const message = parsed.error.issues[0]?.message ?? "Invalid arguments";
		ctx.onResult({
			t: "tool_result",
			id: call.id,
			status: "failed",
			error: `Validation failed: ${message}`
		});
		return {
			toolCallId: call.id,
			toolName: call.name,
			status: "failed",
			actionId: null,
			error: message
		};
	}

	const args = parsed.data as ArgsOf<typeof call.name>;
	const baseTier: SafetyTier = resolvedTier(call.name, args);
	const anomalies = detectAnomalies(call.name, args, snapshotAppState(), ctx.anomalySettings);
	if (anomalies.length > 0) {
		ctx.onResult({
			t: "anomaly",
			toolCallId: call.id,
			reasons: anomalies.map((a) => `${a.key}: ${a.reason}`)
		});
	}
	const effectiveTier: SafetyTier = baseTier === "B" || anomalies.length > 0 ? "B" : "A";
	const requiredConfirmation = effectiveTier === "B";

	if (requiredConfirmation) {
		ctx.onResult({ t: "tool_result", id: call.id, status: "pending_confirmation" });
		const approved = await ctx.requestConfirmation({
			toolCallId: call.id,
			toolName: call.name,
			args,
			tier: effectiveTier,
			anomalies,
			humanLabel: humanLabelFor(call.name, args)
		});
		if (!approved) {
			const actionId = await recordAction({
				conversationId: ctx.conversationId,
				messageId: ctx.messageId,
				toolName: call.name,
				inputs: args,
				inverse: { tool: "noop", args: {} },
				safetyTier: effectiveTier,
				requiredConfirmation,
				anomalies,
				applied: false,
				status: "rejected",
				error: null
			});
			ctx.onResult({
				t: "tool_result",
				id: call.id,
				status: "rejected",
				actionId: actionId ?? undefined
			});
			return {
				toolCallId: call.id,
				toolName: call.name,
				status: "rejected",
				actionId,
				error: null
			};
		}
	}

	try {
		const executor = executors[call.name];
		const result = await executor(args as never);
		const actionId = await recordAction({
			conversationId: ctx.conversationId,
			messageId: ctx.messageId,
			toolName: call.name,
			inputs: args,
			inverse: result.inverse,
			safetyTier: effectiveTier,
			requiredConfirmation,
			anomalies,
			applied: true,
			status: "applied",
			error: null
		});
		ctx.onResult({
			t: "tool_result",
			id: call.id,
			status: "applied",
			actionId: actionId ?? undefined
		});
		return {
			toolCallId: call.id,
			toolName: call.name,
			status: "applied",
			actionId,
			error: null
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : "Tool execution failed";
		const actionId = await recordAction({
			conversationId: ctx.conversationId,
			messageId: ctx.messageId,
			toolName: call.name,
			inputs: args,
			inverse: { tool: "noop", args: {} },
			safetyTier: effectiveTier,
			requiredConfirmation,
			anomalies,
			applied: false,
			status: "failed",
			error: message
		});
		ctx.onResult({
			t: "tool_result",
			id: call.id,
			status: "failed",
			error: message,
			actionId: actionId ?? undefined
		});
		return {
			toolCallId: call.id,
			toolName: call.name,
			status: "failed",
			actionId,
			error: message
		};
	}
};

export const isToolKnown = (name: string): boolean => name in TIER_MAP;
