import { and, asc, eq, max, sql } from "drizzle-orm";
import type { Database } from "../db";
import { clients, clientPaymentMethods, invoiceEntries, paymentMethods } from "../schema";
import type { Client, Currency, MonthName } from "$lib/types";
import { MONTHS } from "$lib/invoice/months";
import { toClient, toInvoiceEntry } from "../dto";

const currentYear = () => new Date().getFullYear();

const sqlInArray = <T>(column: T, values: string[]) => {
	return sql`${column} IN (${sql.join(
		values.map((v) => sql`${v}`),
		sql`, `
	)})`;
};

const nextClientPosition = async (db: Database, userId: string): Promise<number> => {
	const result = await db
		.select({ value: max(clients.position) })
		.from(clients)
		.where(eq(clients.userId, userId))
		.get();
	const current = result?.value;
	return typeof current === "number" ? current + 1 : 0;
};

const nextEntryPosition = async (db: Database, clientId: string): Promise<number> => {
	const result = await db
		.select({ value: max(invoiceEntries.position) })
		.from(invoiceEntries)
		.where(eq(invoiceEntries.clientId, clientId))
		.get();
	const current = result?.value;
	return typeof current === "number" ? current + 1 : 0;
};

const ownsClient = async (db: Database, userId: string, clientId: string): Promise<boolean> => {
	const row = await db
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
		.get();
	return !!row;
};

export interface ClientListing {
	clients: Client[];
	expanded: Record<string, boolean>;
}

export const listClientsByUser = async (db: Database, userId: string): Promise<ClientListing> => {
	const clientRows = await db
		.select()
		.from(clients)
		.where(eq(clients.userId, userId))
		.orderBy(asc(clients.position), asc(clients.createdAt))
		.all();

	if (clientRows.length === 0) return { clients: [], expanded: {} };
	const clientIds = clientRows.map((c) => c.id);

	const entries = await db
		.select()
		.from(invoiceEntries)
		.where(sqlInArray(invoiceEntries.clientId, clientIds))
		.orderBy(asc(invoiceEntries.position), asc(invoiceEntries.createdAt))
		.all();

	const links = await db
		.select()
		.from(clientPaymentMethods)
		.where(sqlInArray(clientPaymentMethods.clientId, clientIds))
		.orderBy(asc(clientPaymentMethods.position))
		.all();

	const entriesByClient = new Map<string, typeof entries>();
	for (const e of entries) {
		const list = entriesByClient.get(e.clientId) ?? [];
		list.push(e);
		entriesByClient.set(e.clientId, list);
	}

	const methodIdsByClient = new Map<string, string[]>();
	for (const link of links) {
		const list = methodIdsByClient.get(link.clientId) ?? [];
		list.push(link.paymentMethodId);
		methodIdsByClient.set(link.clientId, list);
	}

	const expanded: Record<string, boolean> = {};
	const projected = clientRows.map((row) => {
		expanded[row.id] = row.expanded;
		return toClient(row, entriesByClient.get(row.id) ?? [], methodIdsByClient.get(row.id) ?? []);
	});

	return { clients: projected, expanded };
};

const cloneFromTemplate = async (
	db: Database,
	userId: string,
	templateId: string
): Promise<{
	source: typeof clients.$inferSelect;
	methodIds: string[];
	entryShapes: { month: MonthName; issueDay: string; dueDay: string }[];
} | null> => {
	const source = await db
		.select()
		.from(clients)
		.where(and(eq(clients.id, templateId), eq(clients.userId, userId)))
		.get();
	if (!source) return null;

	const methodIdsRows = await db
		.select({ id: clientPaymentMethods.paymentMethodId })
		.from(clientPaymentMethods)
		.where(eq(clientPaymentMethods.clientId, templateId))
		.orderBy(asc(clientPaymentMethods.position))
		.all();

	const entryRows = await db
		.select()
		.from(invoiceEntries)
		.where(eq(invoiceEntries.clientId, templateId))
		.orderBy(asc(invoiceEntries.position), asc(invoiceEntries.createdAt))
		.all();

	return {
		source,
		methodIds: methodIdsRows.map((r) => r.id),
		entryShapes: entryRows.map((e) => ({
			month: e.month as MonthName,
			issueDay: e.issueDay,
			dueDay: e.dueDay
		}))
	};
};

export const createClient = async (
	db: Database,
	userId: string,
	templateId?: string | null
): Promise<Client> => {
	const id = crypto.randomUUID();
	const position = await nextClientPosition(db, userId);
	const template = templateId ? await cloneFromTemplate(db, userId, templateId) : null;

	const baseValues: typeof clients.$inferInsert = {
		id,
		userId,
		name: "",
		invoicePrefix: "",
		phone: "",
		email: "",
		address: [""],
		serviceDescription: template?.source.serviceDescription ?? "",
		serviceAmount: template?.source.serviceAmount ?? 0,
		serviceCurrency: (template?.source.serviceCurrency ?? "BDT") as Currency,
		year: template?.source.year ?? currentYear(),
		expanded: true,
		position
	};

	await db.insert(clients).values(baseValues).run();

	if (template?.methodIds && template.methodIds.length > 0) {
		await db
			.insert(clientPaymentMethods)
			.values(
				template.methodIds.map((mid, i) => ({
					clientId: id,
					paymentMethodId: mid,
					position: i
				}))
			)
			.run();
	}

	const now = new Date();
	const entries = (template?.entryShapes ?? []).map((shape, i) => ({
		id: crypto.randomUUID(),
		clientId: id,
		month: shape.month,
		issueDay: shape.issueDay,
		dueDay: shape.dueDay,
		position: i,
		createdAt: now
	}));
	if (entries.length > 0) {
		await db.insert(invoiceEntries).values(entries).run();
	}

	const inserted = await db.select().from(clients).where(eq(clients.id, id)).get();
	return toClient(inserted!, entries, template?.methodIds ?? []);
};

export interface ClientPatch {
	name?: string;
	invoicePrefix?: string;
	phone?: string;
	email?: string;
	address?: string[];
	serviceDescription?: string;
	serviceAmount?: number;
	serviceCurrency?: Currency;
	year?: number;
	expanded?: boolean;
}

export const updateClient = async (
	db: Database,
	userId: string,
	id: string,
	patch: ClientPatch
): Promise<boolean> => {
	if (!(await ownsClient(db, userId, id))) return false;

	const fields: Record<string, unknown> = { updatedAt: sql`(unixepoch())` };
	if (patch.name !== undefined) fields.name = patch.name;
	if (patch.invoicePrefix !== undefined) fields.invoicePrefix = patch.invoicePrefix;
	if (patch.phone !== undefined) fields.phone = patch.phone;
	if (patch.email !== undefined) fields.email = patch.email;
	if (patch.address !== undefined) fields.address = patch.address;
	if (patch.serviceDescription !== undefined) fields.serviceDescription = patch.serviceDescription;
	if (patch.serviceAmount !== undefined) fields.serviceAmount = patch.serviceAmount;
	if (patch.serviceCurrency !== undefined) fields.serviceCurrency = patch.serviceCurrency;
	if (patch.year !== undefined) fields.year = patch.year;
	if (patch.expanded !== undefined) fields.expanded = patch.expanded;

	await db
		.update(clients)
		.set(fields)
		.where(and(eq(clients.id, id), eq(clients.userId, userId)))
		.run();
	return true;
};

export const deleteClient = async (db: Database, userId: string, id: string) => {
	await db
		.delete(clients)
		.where(and(eq(clients.id, id), eq(clients.userId, userId)))
		.run();
};

export const setClientPaymentMethods = async (
	db: Database,
	userId: string,
	clientId: string,
	methodIds: string[]
): Promise<boolean> => {
	if (!(await ownsClient(db, userId, clientId))) return false;

	const validRows =
		methodIds.length === 0
			? []
			: await db
					.select({ id: paymentMethods.id })
					.from(paymentMethods)
					.where(and(eq(paymentMethods.userId, userId), sqlInArray(paymentMethods.id, methodIds)))
					.all();
	const validIds = new Set(validRows.map((r) => r.id));
	const filtered = methodIds.filter((id) => validIds.has(id));

	await db.delete(clientPaymentMethods).where(eq(clientPaymentMethods.clientId, clientId)).run();
	if (filtered.length > 0) {
		await db
			.insert(clientPaymentMethods)
			.values(
				filtered.map((mid, i) => ({
					clientId,
					paymentMethodId: mid,
					position: i
				}))
			)
			.run();
	}
	return true;
};

export const addInvoiceEntry = async (db: Database, userId: string, clientId: string) => {
	if (!(await ownsClient(db, userId, clientId))) return null;

	const last = await db
		.select()
		.from(invoiceEntries)
		.where(eq(invoiceEntries.clientId, clientId))
		.orderBy(sql`${invoiceEntries.position} DESC`, sql`${invoiceEntries.createdAt} DESC`)
		.limit(1)
		.get();

	const nextMonth: MonthName = last
		? MONTHS[(MONTHS.indexOf(last.month as MonthName) + 1) % MONTHS.length]
		: "January";

	const id = crypto.randomUUID();
	const position = await nextEntryPosition(db, clientId);

	await db
		.insert(invoiceEntries)
		.values({
			id,
			clientId,
			month: nextMonth,
			issueDay: last?.issueDay ?? "01",
			dueDay: last?.dueDay ?? "07",
			position
		})
		.run();

	const inserted = await db.select().from(invoiceEntries).where(eq(invoiceEntries.id, id)).get();
	return toInvoiceEntry(inserted!);
};

export const updateInvoiceEntry = async (
	db: Database,
	userId: string,
	clientId: string,
	entryId: string,
	patch: { month?: MonthName; issueDay?: string; dueDay?: string }
) => {
	if (!(await ownsClient(db, userId, clientId))) return false;
	const fields: Record<string, unknown> = {};
	if (patch.month !== undefined) fields.month = patch.month;
	if (patch.issueDay !== undefined) fields.issueDay = patch.issueDay;
	if (patch.dueDay !== undefined) fields.dueDay = patch.dueDay;
	if (Object.keys(fields).length === 0) return true;

	await db
		.update(invoiceEntries)
		.set(fields)
		.where(and(eq(invoiceEntries.id, entryId), eq(invoiceEntries.clientId, clientId)))
		.run();
	return true;
};

export const deleteInvoiceEntry = async (
	db: Database,
	userId: string,
	clientId: string,
	entryId: string
) => {
	if (!(await ownsClient(db, userId, clientId))) return false;
	await db
		.delete(invoiceEntries)
		.where(and(eq(invoiceEntries.id, entryId), eq(invoiceEntries.clientId, clientId)))
		.run();
	return true;
};
