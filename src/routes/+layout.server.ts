import type { LayoutServerLoad } from "./$types";

/**
 * Root layout load. Surfaces the auth identity populated by `hooks.server.ts`
 * (`locals.user/session/currentUser`) plus the `aiEnabled` feature flag into
 * every page's data.
 *
 * @returns user, session, currentUser, aiEnabled
 *
 * INVARIANT: aiEnabled defaults to true — it is false ONLY when the
 * `AI_COPILOT_ENABLED` var is exactly the string `"false"` (unset/missing → on).
 */
export const load: LayoutServerLoad = async ({ locals, platform }) => {
	const aiEnabled = platform?.env?.AI_COPILOT_ENABLED !== "false";
	return {
		user: locals.user,
		session: locals.session,
		currentUser: locals.currentUser,
		aiEnabled
	};
};
