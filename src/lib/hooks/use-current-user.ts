import { findBrandByEmail } from "$lib/config";
import type { CurrentUser } from "$lib/types";

export const getCurrentUser = (email: string | undefined): CurrentUser | null => {
	if (!email) return null;
	const brand = findBrandByEmail(email);
	if (!brand) return null;
	return { name: brand.name };
};

export const isEmailAuthorized = (email: string | undefined): boolean => {
	if (!email) return false;
	return findBrandByEmail(email) !== undefined;
};
