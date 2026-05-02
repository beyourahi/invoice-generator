import type { Currency } from "$lib/types";

const SYMBOLS: Record<Currency, string> = {
	BDT: "৳",
	USD: "$"
};

export const currencySymbol = (currency: Currency): string => SYMBOLS[currency];

export const formatAmount = (amount: number, currency: Currency): string =>
	`${currencySymbol(currency)}${amount.toLocaleString("en-US")}`;
