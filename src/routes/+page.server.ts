import type { PageServerLoad } from "./$types";
import { getDatabase } from "$lib/server/db";
import { loadAppState } from "$lib/server/repositories/state";
import type { AppState } from "$lib/server/dto";
import {
	getMostRecentConversation,
	listConversations
} from "$lib/server/repositories/ai-conversations";
import { listMessages } from "$lib/server/repositories/ai-messages";
import { listRecent } from "$lib/server/repositories/ai-actions";
import { DEFAULT_ANOMALY_SETTINGS } from "$lib/ai/types";
import type { AiHydrationPayload } from "$lib/stores/ai.svelte";

// Zero-state AI payload used when AI is disabled or D1/user is unavailable.
const emptyAi = (enabled: boolean): AiHydrationPayload => ({
	enabled,
	activeConversation: null,
	conversations: [],
	messages: [],
	recentActions: [],
	anomalySettings: { ...DEFAULT_ANOMALY_SETTINGS }
});

/**
 * Home page load. Auth is OPTIONAL: logged-out visitors get the full builder (it
 * persists to localStorage client-side; the PDF pipeline is client-side anyway).
 * Signing in unlocks server storage + cross-device sync + the AI Copilot, and
 * imports the guest snapshot once. Server data is hydrated ONLY for an
 * authenticated session; anonymous visitors get empty shells and re-seed from
 * localStorage on mount.
 *
 * CONTRACT:
 *  - inputs: locals.user (auth identity), platform.env.DB (D1), AI_COPILOT_ENABLED var.
 *  - outputs: { user, currentUser, appState, ai }. appState/ai default to empty
 *    shells when D1/user is absent so the page still renders.
 *  - SIDE EFFECTS: read-only D1 queries.
 *
 * The AI block is skipped entirely when aiEnabled is false. Conversation/message/
 * action timestamps are serialized to ISO strings here because the wire payload
 * must be JSON-safe (Date does not survive load → client).
 */
export const load: PageServerLoad = async ({ locals, platform }) => {
	const d1 = platform?.env?.DB;
	const aiEnabled = platform?.env?.AI_COPILOT_ENABLED !== "false";
	let appState: AppState = {
		fixed: { from: { name: "", phone: "", email: "", address: "" }, paymentMethods: [] },
		clients: [],
		selectedClientId: null,
		expandedClients: {}
	};
	let ai: AiHydrationPayload = emptyAi(aiEnabled);

	if (d1 && locals.user) {
		const db = getDatabase(d1);
		const userId = locals.user.id;
		appState = await loadAppState(db, userId);

		if (aiEnabled) {
			const [recentConv, conversations, recentActions] = await Promise.all([
				getMostRecentConversation(db, userId),
				listConversations(db, userId, 50),
				listRecent(db, userId, 50)
			]);
			const messages = recentConv ? await listMessages(db, recentConv.id, 200) : [];

			ai = {
				enabled: aiEnabled,
				activeConversation: recentConv
					? {
							id: recentConv.id,
							title: recentConv.title,
							updatedAt: recentConv.updatedAt.toISOString()
						}
					: null,
				conversations: conversations.map((c) => ({
					id: c.id,
					title: c.title,
					updatedAt: c.updatedAt.toISOString()
				})),
				messages: messages.map((m) => ({
					id: m.id,
					role: m.role,
					content: m.content,
					toolCalls: (m.toolCalls ?? []).map((tc) => {
						// Join the persisted tool result; a missing one (legacy/mid-flight
						// turn) defaults to neutral "pending", never a false "applied".
						const result = m.toolResults?.find((r) => r.id === tc.id);
						return {
							id: tc.id,
							name: tc.name,
							args: tc.args,
							status: result?.status ?? ("pending" as const),
							actionId: result?.actionId ?? null,
							error: result?.error ?? null,
							anomalies: [],
							undone: false
						};
					}),
					createdAt: m.createdAt.toISOString(),
					streaming: false
				})),
				recentActions: recentActions.map((a) => ({
					id: a.id,
					conversationId: a.conversationId,
					messageId: a.messageId,
					toolName: a.toolName,
					inputs: a.inputs,
					inverse: a.inverse,
					safetyTier: a.safetyTier,
					requiredConfirmation: a.requiredConfirmation,
					anomalyTriggered: a.anomalyTriggered,
					applied: a.applied,
					status: a.status,
					error: a.error,
					createdAt: a.createdAt.toISOString(),
					undoneAt: a.undoneAt?.toISOString() ?? null
				})),
				anomalySettings: { ...DEFAULT_ANOMALY_SETTINGS }
			};
		}
	}

	return {
		user: locals.user,
		currentUser: locals.currentUser,
		appState,
		ai
	};
};
