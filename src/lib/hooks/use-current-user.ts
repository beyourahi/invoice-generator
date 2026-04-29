import type { CurrentUser } from "$lib/types";

export const getCurrentUser = (
	user: { name: string; email: string } | null | undefined
): CurrentUser | null => {
	if (!user) return null;
	return { name: user.name, email: user.email };
};
