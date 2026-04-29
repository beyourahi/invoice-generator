import type { HandleClientError } from "@sveltejs/kit";

export const handleError: HandleClientError = async ({ error, status, message }) => {
	const errorId = crypto.randomUUID();

	console.error(`[${errorId}] Client error:`, {
		status,
		message,
		error: error instanceof Error ? { name: error.name, message: error.message } : error
	});

	return {
		message: status >= 500 ? "An unexpected error occurred" : message,
		errorId
	};
};
