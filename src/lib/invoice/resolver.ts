export const resolveTokens = (template: string, tokens: Record<string, string>): string =>
	Object.entries(tokens).reduce((acc, [key, value]) => acc.replaceAll(`{${key}}`, value), template);
