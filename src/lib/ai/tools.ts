import type { z } from "zod";

export type SafetyTier = "A" | "B";

export interface ToolDef<Args = unknown, Result = unknown> {
	name: string;
	description: string;
	argSchema: z.ZodTypeAny;
	safetyTier: SafetyTier;
	execute: (args: Args) => Promise<Result>;
	inverse: (args: Args, result: Result) => { tool: string; args: unknown; snapshot?: unknown };
}

export const TOOL_REGISTRY: Record<string, ToolDef> = {};
