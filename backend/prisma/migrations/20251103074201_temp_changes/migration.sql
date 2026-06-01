-- AlterTable
ALTER TABLE "members" ADD COLUMN     "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
