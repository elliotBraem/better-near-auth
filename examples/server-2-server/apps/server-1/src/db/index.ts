import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.DATABASE_CONNECTION_URL || "file:./database.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client);
