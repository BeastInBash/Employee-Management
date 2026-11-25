-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
