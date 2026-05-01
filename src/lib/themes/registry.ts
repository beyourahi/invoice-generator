import { defaultTheme } from "./default";

export type ThemeId = "default";

export interface Theme {
	id: ThemeId;
	name: string;
	html: string;
	css: string;
	paymentMethodFields: string;
	paymentMethodLink: string;
	paymentField: string;
}

export const themes: Record<ThemeId, Theme> = {
	default: defaultTheme
};

export const getTheme = (id: ThemeId): Theme => themes[id];

export const ACTIVE_THEME_ID: ThemeId = "default";
