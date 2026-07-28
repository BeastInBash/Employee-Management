-- AlterTable: per-workspace task submission window (minutes from IST midnight).
-- Defaults to disabled so existing workspaces let members submit tasks anytime.
ALTER TABLE "workspaces" ADD COLUMN "taskWindowEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workspaces" ADD COLUMN "taskWindowStart" INTEGER NOT NULL DEFAULT 540;
ALTER TABLE "workspaces" ADD COLUMN "taskWindowEnd" INTEGER NOT NULL DEFAULT 660;
