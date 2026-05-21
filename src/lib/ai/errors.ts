const KNOWN: Array<{ match: RegExp; message: string }> = [
	{
		match: /not found in current state|not found on client|Entry .+ not found|Payment method .+ not found|not found\./i,
		message: "I couldn't find that — it may have been changed or removed. Refresh and try again."
	},
	{
		match: /Unknown tool/i,
		message: "I tried to do something that isn't supported here."
	},
	{
		match: /Validation failed|Invalid arguments|Empty patch|Invalid request body/i,
		message: "I couldn't apply that change — the details didn't look right. Try rephrasing your request."
	},
	{
		match: /Model invocation failed|Stream read failed|Stream failed|stream error|Empty response|AI binding/i,
		message: "I couldn't reach the assistant just now. Please try again in a moment."
	},
	{
		match: /Failed to create payment method/i,
		message: "I couldn't add that payment method. Please try again."
	},
	{
		match: /Request failed/i,
		message: "The request didn't go through. Please try again."
	}
];

const looksTechnical = (text: string): boolean =>
	/[{}[\]<>]/.test(text) ||
	/https?:\/\//i.test(text) ||
	/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i.test(text) ||
	/\b(?:cli|ent|pm)_\d+\b/.test(text) ||
	/(?:TypeError|ReferenceError|SyntaxError|Cannot read|is not a function|undefined|\bnull\b|at .+:\d+)/i.test(
		text
	) ||
	text.length > 200;

const GENERIC = "Something went wrong while doing that. Please try again.";

export const friendlyErrorMessage = (raw: unknown): string => {
	const text = raw instanceof Error ? raw.message : typeof raw === "string" ? raw.trim() : "";
	if (!text) return GENERIC;
	for (const entry of KNOWN) {
		if (entry.match.test(text)) return entry.message;
	}
	return looksTechnical(text) ? GENERIC : text;
};
