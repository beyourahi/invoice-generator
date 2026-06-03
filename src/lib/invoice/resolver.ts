/**
 * Pure token substitution: replaces every `{KEY}` literal in `template` with its
 * mapped value. Uses String.prototype.replaceAll — NOT regex — so tokens resolve
 * only on EXACT, CASE-SENSITIVE literal match (`{MONTH}` ≠ `{month}`). Values are
 * inserted verbatim; the caller is responsible for any HTML-escaping beforehand.
 */
export const resolveTokens = (template: string, tokens: Record<string, string>): string =>
	Object.entries(tokens).reduce((acc, [key, value]) => acc.replaceAll(`{${key}}`, value), template);
