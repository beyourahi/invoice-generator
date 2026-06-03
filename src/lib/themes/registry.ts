/**
 * Theme registry. A Theme bundles the full HTML document template, its inlined
 * CSS, and the three payment-method partial templates (fields wrapper, link
 * wrapper, single field row) that builder.ts composes.
 *
 * Only one theme exists. ACTIVE_THEME_ID is HARDCODED — there is no runtime
 * switcher; adding a theme means a new file, a `themes` entry, a ThemeId union
 * member, and (if switching) a build-time change to ACTIVE_THEME_ID.
 */
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

const themes: Record<ThemeId, Theme> = {
	default: defaultTheme
};

export const getTheme = (id: ThemeId): Theme => themes[id];

export const ACTIVE_THEME_ID: ThemeId = "default";
