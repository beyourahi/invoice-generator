/**
 * Pure token substitution: replaces every `{KEY}` literal in `template` with its
 * mapped value in a SINGLE pass over the original template — inserted values are
 * never re-scanned, so user text that happens to contain a token name (e.g. a
 * description containing `{CSS}`) is left untouched rather than substituted.
 * Tokens match an EXACT, CASE-SENSITIVE `{[A-Z_]+}` literal; unknown tokens pass
 * through verbatim. Values are inserted verbatim; the caller is responsible for
 * any HTML-escaping beforehand.
 */
export const resolveTokens = (template: string, tokens: Record<string, string>): string =>
	template.replace(/\{([A-Z_]+)\}/g, (m, k) => (k in tokens ? tokens[k] : m));
