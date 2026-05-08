---
"better-near-auth": patch
---

Add Docker Compose for PostgreSQL and fix SSL for local connections

- Add `docker-compose.yml` with `postgres-api` (port 5432) and `postgres-auth` (port 5433) services
- Fix database drivers (`api/src/db/index.ts`, `plugins/auth/src/db/driver.ts`) to disable SSL for localhost connections
- Add `API_DATABASE_URL` to `bos.config.json` API secrets so the runtime injects it into the API plugin
- Update `.env` with PostgreSQL connection strings matching Docker services
- Update `.env.example` with `AUTH_DATABASE_URL` entry and Docker URL comments
