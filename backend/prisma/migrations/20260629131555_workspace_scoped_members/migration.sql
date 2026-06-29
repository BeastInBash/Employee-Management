-- DropIndex
DROP INDEX "members_userId_key";

-- AlterTable: add workspaceId as nullable first so existing rows can be backfilled
ALTER TABLE "members" ADD COLUMN "workspaceId" TEXT;

-- Backfill existing members to the earliest existing workspace
-- (dev data: a single workspace exists, so this is deterministic)
UPDATE "members"
SET "workspaceId" = (SELECT "id" FROM "workspaces" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "workspaceId" IS NULL;

-- Enforce NOT NULL now that existing rows are backfilled
ALTER TABLE "members" ALTER COLUMN "workspaceId" SET NOT NULL;

-- AlterTable
ALTER TABLE "workspace_memberships" ALTER COLUMN "workspaceId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "members_userId_workspaceId_key" ON "members"("userId", "workspaceId");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
