import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// DATABASE_URL may be undefined during build-time page data collection.
// neon() throws if given an empty string, so we use a dummy postgres://
// URL at build time. The client is never called during the build -- only
// at request time when the real env var is available.
const databaseUrl =
  process.env.DATABASE_URL || "postgresql://build:build@localhost:5432/build";

const sql = neon(databaseUrl);

export const db = drizzle(sql, { schema });
