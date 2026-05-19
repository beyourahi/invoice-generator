export interface InverseRecord {
	tool: string;
	args: unknown;
	snapshot?: unknown;
}

export const captureInverse = (toolName: string, _args: unknown, _result: unknown): InverseRecord => {
	return { tool: toolName, args: {} };
};
