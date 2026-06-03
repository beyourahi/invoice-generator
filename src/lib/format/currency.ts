import type { Currency } from "$lib/types";

const SYMBOLS: Record<Currency, string> = {
	BDT: "৳",
	USD: "$"
};

const currencySymbol = (currency: Currency): string => SYMBOLS[currency];

// Symbol prefix + en-US grouped integer/decimal formatting, regardless of the
// currency's own locale conventions (both BDT and USD render "en-US" style).
export const formatAmount = (amount: number, currency: Currency): string =>
	`${currencySymbol(currency)}${amount.toLocaleString("en-US")}`;
