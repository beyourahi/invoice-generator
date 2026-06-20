/**
 * Drizzle schema for the entire D1 database: Better Auth tables (users, sessions, accounts,
 * verifications, rate_limits), app tables (fixed_settings, payment_methods, clients,
 * client_payment_methods, invoice_entries), and AI Copilot tables (ai_conversations,
 * ai_messages, ai_actions).
 * INVARIANT: column names are snake_case as REQUIRED by the Better Auth Drizzle adapter
 * (usePlural + snake columns); renaming them breaks auth. All app/AI tables cascade-delete
 * from users.id, so removing a user purges all their data.
 */
import { relations } from "drizzle-orm";
import {
	sqliteTable,
	text,
	integer,
	blob,
	index,
	uniqueIndex,
	primaryKey
} from "drizzle-orm/sqlite-core";
import type { Currency, MonthName, PaymentMethodKind } from "$lib/types";

export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
	name: text("name"),
	image: text("image"),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull()
});

export const sessions = sqliteTable(
	"sessions",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		token: text("token").notNull().unique(),
		expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" }).notNull()
	},
	(table) => [index("idx_sessions_user_id").on(table.userId)]
);

export const accounts = sqliteTable(
	"accounts",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
		refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
		scope: text("scope"),
		idToken: text("id_token"),
		password: text("password"),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" }).notNull()
	},
	(table) => [
		index("idx_accounts_user_id").on(table.userId),
		uniqueIndex("idx_accounts_provider").on(table.providerId, table.accountId)
	]
);

export const verifications = sqliteTable(
	"verifications",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" }).notNull()
	},
	(table) => [index("idx_verifications_identifier").on(table.identifier)]
);

export const rateLimits = sqliteTable(
	"rate_limits",
	{
		id: text("id").primaryKey(),
		key: text("key").notNull(),
		count: integer("count").notNull(),
		lastRequest: integer("last_request").notNull()
	},
	(table) => [index("idx_rate_limits_key").on(table.key)]
);

// One row per user (PK = user_id). Holds the fixed sender identity plus the persisted
// selected-client UI state. selected_client_id is a soft reference (no FK) — a deleted client
// leaves a dangling id that the loader tolerates.
export const fixedSettings = sqliteTable("fixed_settings", {
	userId: text("user_id")
		.primaryKey()
		.references(() => users.id, { onDelete: "cascade" }),
	fromName: text("from_name").notNull().default(""),
	fromPhone: text("from_phone").notNull().default(""),
	fromEmail: text("from_email").notNull().default(""),
	fromAddress: text("from_address").notNull().default(""),
	selectedClientId: text("selected_client_id"),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date())
});

// One row per user (PK = user_id). Holds the BYO Cloudflare connection used by the AI Copilot:
// the user's account-scoped Workers AI API token (AES-GCM encrypted at rest — see crypto.ts),
// their account id, and the selected chat model. Cascade-deletes with the user.
export const userSettings = sqliteTable("user_settings", {
	userId: text("user_id")
		.primaryKey()
		.references(() => users.id, { onDelete: "cascade" }),
	cloudflareTokenEncrypted: blob("cloudflare_token_encrypted"),
	cloudflareAccountId: text("cloudflare_account_id"),
	cloudflareModel: text("cloudflare_model")
});

export const paymentMethods = sqliteTable(
	"payment_methods",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		kind: text("kind").$type<PaymentMethodKind>().notNull(),
		label: text("label").notNull().default(""),
		values: text("values", { mode: "json" }).$type<Record<string, string>>().notNull().default({}),
		position: integer("position").notNull().default(0),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [
		index("idx_payment_methods_user_id").on(table.userId),
		index("idx_payment_methods_user_position").on(table.userId, table.position)
	]
);

export const clients = sqliteTable(
	"clients",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: text("name").notNull().default(""),
		invoicePrefix: text("invoice_prefix").notNull().default(""),
		phone: text("phone").notNull().default(""),
		email: text("email").notNull().default(""),
		address: text("address", { mode: "json" }).$type<string[]>().notNull().default([""]),
		serviceDescription: text("service_description").notNull().default(""),
		serviceAmount: integer("service_amount").notNull().default(0),
		serviceCurrency: text("service_currency").$type<Currency>().notNull().default("BDT"),
		year: integer("year").notNull(),
		expanded: integer("expanded", { mode: "boolean" }).notNull().default(true),
		isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
		position: integer("position").notNull().default(0),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [
		index("idx_clients_user_id").on(table.userId),
		index("idx_clients_user_position").on(table.userId, table.position)
	]
);

// Join table: ordered many-to-many between clients and payment_methods (composite PK).
// Cascade on both FKs means deleting either side removes the link. `position` carries the
// per-client display/PDF order.
export const clientPaymentMethods = sqliteTable(
	"client_payment_methods",
	{
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		paymentMethodId: text("payment_method_id")
			.notNull()
			.references(() => paymentMethods.id, { onDelete: "cascade" }),
		position: integer("position").notNull().default(0)
	},
	(table) => [
		primaryKey({ columns: [table.clientId, table.paymentMethodId] }),
		index("idx_client_payment_methods_client").on(table.clientId),
		index("idx_client_payment_methods_method").on(table.paymentMethodId)
	]
);

export const invoiceEntries = sqliteTable(
	"invoice_entries",
	{
		id: text("id").primaryKey(),
		clientId: text("client_id")
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),
		month: text("month").$type<MonthName>().notNull(),
		issueDay: text("issue_day").notNull().default("01"),
		dueDay: text("due_day").notNull().default("07"),
		isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
		position: integer("position").notNull().default(0),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [
		index("idx_invoice_entries_client_id").on(table.clientId),
		index("idx_invoice_entries_client_position").on(table.clientId, table.position)
	]
);

export const aiConversations = sqliteTable(
	"ai_conversations",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [index("ai_conversations_user_updated_idx").on(table.userId, table.updatedAt)]
);

export const aiMessages = sqliteTable(
	"ai_messages",
	{
		id: text("id").primaryKey(),
		conversationId: text("conversation_id")
			.notNull()
			.references(() => aiConversations.id, { onDelete: "cascade" }),
		role: text("role").$type<"user" | "assistant" | "tool" | "system">().notNull(),
		content: text("content").notNull(),
		toolCalls: text("tool_calls", { mode: "json" }).$type<
			Array<{ id: string; name: string; args: unknown }>
		>(),
		toolResults: text("tool_results", { mode: "json" }).$type<
			Array<{ id: string; status: string; error?: string }>
		>(),
		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [
		index("ai_messages_conversation_created_idx").on(table.conversationId, table.createdAt)
	]
);

// Audit/undo log for AI Copilot tool executions. `inverse` (JSON) stores the reverse tool call
// consumed by ai-undo.applyInverse. conversation_id/message_id use ON DELETE SET NULL so the
// action history survives deletion of its originating conversation.
export const aiActions = sqliteTable(
	"ai_actions",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		conversationId: text("conversation_id").references(() => aiConversations.id, {
			onDelete: "set null"
		}),
		messageId: text("message_id").references(() => aiMessages.id, { onDelete: "set null" }),
		toolName: text("tool_name").notNull(),
		inputs: text("inputs", { mode: "json" }).$type<unknown>().notNull(),
		inverse: text("inverse", { mode: "json" })
			.$type<{ tool: string; args: unknown; snapshot?: unknown }>()
			.notNull(),
		safetyTier: text("safety_tier").$type<"A" | "B">().notNull(),
		requiredConfirmation: integer("required_confirmation", { mode: "boolean" }).notNull(),
		anomalyTriggered: text("anomaly_triggered"),
		applied: integer("applied", { mode: "boolean" }).notNull(),
		status: text("status")
			.$type<"applied" | "rejected" | "failed" | "undone" | "undo_failed">()
			.notNull(),
		error: text("error"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
		undoneAt: integer("undone_at", { mode: "timestamp" })
	},
	(table) => [
		index("ai_actions_user_created_idx").on(table.userId, table.createdAt),
		index("ai_actions_user_status_idx").on(table.userId, table.status)
	]
);

export const usersRelations = relations(users, ({ one, many }) => ({
	fixedSettings: one(fixedSettings, {
		fields: [users.id],
		references: [fixedSettings.userId]
	}),
	userSettings: one(userSettings, {
		fields: [users.id],
		references: [userSettings.userId]
	}),
	paymentMethods: many(paymentMethods),
	clients: many(clients),
	aiConversations: many(aiConversations),
	aiActions: many(aiActions)
}));

export const fixedSettingsRelations = relations(fixedSettings, ({ one }) => ({
	user: one(users, { fields: [fixedSettings.userId], references: [users.id] })
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
	user: one(users, { fields: [userSettings.userId], references: [users.id] })
}));

export const paymentMethodsRelations = relations(paymentMethods, ({ one, many }) => ({
	user: one(users, { fields: [paymentMethods.userId], references: [users.id] }),
	clientLinks: many(clientPaymentMethods)
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
	user: one(users, { fields: [clients.userId], references: [users.id] }),
	invoices: many(invoiceEntries),
	paymentLinks: many(clientPaymentMethods)
}));

export const clientPaymentMethodsRelations = relations(clientPaymentMethods, ({ one }) => ({
	client: one(clients, {
		fields: [clientPaymentMethods.clientId],
		references: [clients.id]
	}),
	method: one(paymentMethods, {
		fields: [clientPaymentMethods.paymentMethodId],
		references: [paymentMethods.id]
	})
}));

export const invoiceEntriesRelations = relations(invoiceEntries, ({ one }) => ({
	client: one(clients, { fields: [invoiceEntries.clientId], references: [clients.id] })
}));

export const aiConversationsRelations = relations(aiConversations, ({ one, many }) => ({
	user: one(users, { fields: [aiConversations.userId], references: [users.id] }),
	messages: many(aiMessages),
	actions: many(aiActions)
}));

export const aiMessagesRelations = relations(aiMessages, ({ one }) => ({
	conversation: one(aiConversations, {
		fields: [aiMessages.conversationId],
		references: [aiConversations.id]
	})
}));

export const aiActionsRelations = relations(aiActions, ({ one }) => ({
	user: one(users, { fields: [aiActions.userId], references: [users.id] }),
	conversation: one(aiConversations, {
		fields: [aiActions.conversationId],
		references: [aiConversations.id]
	}),
	message: one(aiMessages, { fields: [aiActions.messageId], references: [aiMessages.id] })
}));
