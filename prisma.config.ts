import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 reads migration/introspection connection details from here (the
// schema no longer holds a `url`). The Prisma CLI does not auto-load .env, so
// load it manually (Node 20.12+ ships process.loadEnvFile).
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // .env is optional (e.g. on Vercel where vars are injected directly).
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    // Read directly instead of via `env()`, which throws when the variable is
    // unset. `prisma generate` (run on postinstall, before a .env exists) never
    // connects, so it must not require DATABASE_URL; `db push` / `migrate`
    // still fail with a clear error when it is missing.
    url: process.env.DATABASE_URL,
  },
});
