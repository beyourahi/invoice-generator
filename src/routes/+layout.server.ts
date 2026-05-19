import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals, platform }) => {
	const aiEnabled = platform?.env?.AI_COPILOT_ENABLED !== "false";
	return {
		user: locals.user,
		session: locals.session,
		currentUser: locals.currentUser,
		aiEnabled
	};
};
