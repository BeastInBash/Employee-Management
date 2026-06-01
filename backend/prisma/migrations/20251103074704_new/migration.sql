/*
  Warnings:

  - You are about to drop the column `email` on the `members` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `members` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "members" DROP COLUMN "email",
DROP COLUMN "name";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "country";
