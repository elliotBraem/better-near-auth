import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./lib/auth";
import { createContext } from "./lib/context";
import { appRouter } from "./routers";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./db";
import { RPCHandler } from "@orpc/server/fetch";

const app = new Hono();

app.use(logger());

// CORS configuration
const getCorsOrigins = () => {
  if (process.env.CORS_ORIGIN) {
    return process.env.CORS_ORIGIN.split(",").map(origin => origin.trim());
  }
  // Default to allowing localhost:3001 (web app) in development
  // Note: Cannot use ["*"] when credentials: true, must specify explicit origins
  return ["http://localhost:3001", "http://localhost:3000"];
};

app.use(
  "/*",
  cors({
    origin: getCorsOrigins(),
    allowMethods: ["GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
    maxAge: 86400, // 24 hours
  })
);

app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));
const handler = new RPCHandler(appRouter);

app.use('/rpc/*', async (c, next) => {
  const { matched, response } = await handler.handle(c.req.raw, {
    prefix: '/rpc',
    context: await createContext({ context: c })
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});

try {
  console.log("Migrating database...");
  migrate(db, {
    migrationsFolder: `${process.cwd()}/migrations`,
  });
} catch (error) {
  console.error(error);
}


export default app;
