import type { Currency } from "$lib/types";

const SYMBOLS: Record<Currency, string> = {
	BDT: "৳",
	USD: "$"
};

const currencySymbol = (currency: Currency): string => SYMBOLS[currency];

// Symbol prefix + en-US grouped integer/decimal formatting, regardless of the
// currency's own locale conventions (both BDT and USD render "en-US" style).
// The minus sign is hoisted ahead of the symbol so negatives read "-$50", not
// "$-50". Positives and zero are byte-identical to a plain symbol+number; -0
// normalizes to "$0".
export const formatAmount = (amount: number, currency: Currency): string => {
	const sign = amount < 0 ? "-" : "";
	return `${sign}${currencySymbol(currency)}${Math.abs(amount).toLocaleString("en-US")}`;
};
