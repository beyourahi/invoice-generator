/**
 * D1 persistence for the single per-user fixed_settings row (sender identity + selected client).
 * The row is created lazily via ensureRow before any write, so new users need no seed step.
 */
import { eq, sql } from "drizzle-orm";
import type { Database } from "../db";
import { fixedSettings } from "../schema";

export interface FromPatch {
	name?: string;
	phone?: string;
	email?: string;
	address?: string;
}

/** Idempotently inserts the user's fixed_settings row (PK = userId) if absent, so subsequent
 * UPDATEs always hit a row. onConflictDoNothing makes concurrent callers safe. */
const ensureRow = async (db: Database, userId: string) => {
	await db
		.insert(fixedSettings)
		.values({ userId })
		.onConflictDoNothing({ target: fixedSettings.userId })
		.run();
};

export const getFixedSettings = (db: Database, userId: string) =>
	db.query.fixedSettings.findFirst({ where: eq(fixedSettings.userId, userId) });

export const upsertFrom = async (db: Database, userId: string, patch: FromPatch) => {
	const fields: Record<string, unknown> = { updatedAt: sql`(unixepoch())` };
	if (patch.name !== undefined) fields.fromName = patch.name;
	if (patch.phone !== undefined) fields.fromPhone = patch.phone;
	if (patch.email !== undefined) fields.fromEmail = patch.email;
	if (patch.address !== undefined) fields.fromAddress = patch.address;

	await ensureRow(db, userId);
	await db.update(fixedSettings).set(fields).where(eq(fixedSettings.userId, userId)).run();
};

export const setSelectedClientId = async (
	db: Database,
	userId: string,
	selectedClientId: string | null
) => {
	await ensureRow(db, userId);
	await db
		.update(fixedSettings)
		.set({ selectedClientId, updatedAt: sql`(unixepoch())` })
		.where(eq(fixedSettings.userId, userId))
		.run();
};
