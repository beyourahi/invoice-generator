import type { Frame } from "./streaming";

export interface ExecuteToolCallParams {
	toolCallId: string;
	name: string;
	args: unknown;
}

export const executeToolCall = async function* (
	_params: ExecuteToolCallParams
): AsyncIterable<Frame> {
	yield {
		t: "tool_result",
		id: _params.toolCallId,
		status: "failed",
		error: "Executor not implemented — landing in Phase 2"
	};
};
