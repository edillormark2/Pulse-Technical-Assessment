import { prisma } from "@/lib/prisma";

/**
 * Count one hit against `key` and report whether it is still within `limit`
 * hits per `windowMs`. A single atomic statement, so concurrent requests
 * cannot both slip under the limit, and it works across serverless
 * instances because the counter lives in Postgres.
 */
export async function allow(key: string, limit: number, windowMs: number): Promise<boolean> {
  const seconds = windowMs / 1000;
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${seconds}) THEN 1
        ELSE "RateLimit"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${seconds}) THEN now()
        ELSE "RateLimit"."windowStart"
      END
    RETURNING "count"`;
  return (rows[0]?.count ?? 0) <= limit;
}

/** Start (or restart) a cooldown on `key`. */
export async function startCooldown(key: string): Promise<void> {
  await prisma.rateLimit.upsert({
    where: { key },
    create: { key, count: 1, windowStart: new Date() },
    update: { count: 1, windowStart: new Date() },
  });
}

/** Whether a cooldown on `key` started less than `ms` ago. */
export async function inCooldown(key: string, ms: number): Promise<boolean> {
  const row = await prisma.rateLimit.findUnique({ where: { key }, select: { windowStart: true } });
  return row !== null && Date.now() - row.windowStart.getTime() < ms;
}
