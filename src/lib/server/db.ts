import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Database = ReturnType<typeof getDatabase>;

export const getDatabase = (d1: D1Database) => drizzle(d1, { schema });

export { schema };
