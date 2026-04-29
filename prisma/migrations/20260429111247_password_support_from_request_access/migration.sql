/*
  Warnings:

  - Added the required column `password_hash` to the `access_requests` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "access_requests" ADD COLUMN     "password_hash" TEXT NOT NULL;
