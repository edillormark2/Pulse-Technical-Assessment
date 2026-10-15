-- Sessions get a secret token (stored only as its SHA-256), calls move to the
-- server, and rate limits get a counter table.
--
-- Presence and Signal hold only live, ephemeral state: who is online right now
-- and undelivered signaling messages. Rows from before this change carry no
-- token and cannot be authenticated, so they are cleared; anyone online simply
-- rejoins on their next poll.
DELETE FROM "Signal";
DELETE FROM "Presence";

-- DropIndex
DROP INDEX "Signal_toId_idx";

-- AlterTable
ALTER TABLE "Presence" DROP COLUMN "busy",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "tokenHash" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "CallMember" (
    "personId" TEXT NOT NULL,
    "peerId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallMember_pkey" PRIMARY KEY ("personId")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "CallMember_peerId_idx" ON "CallMember"("peerId");

-- CreateIndex
CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "Presence_tokenHash_key" ON "Presence"("tokenHash");

-- CreateIndex
CREATE INDEX "Signal_toId_createdAt_idx" ON "Signal"("toId", "createdAt");

-- AddForeignKey
ALTER TABLE "CallMember" ADD CONSTRAINT "CallMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Presence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallMember" ADD CONSTRAINT "CallMember_peerId_fkey" FOREIGN KEY ("peerId") REFERENCES "Presence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Presence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

