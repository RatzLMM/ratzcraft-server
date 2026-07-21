-- AlterTable: add updatedAt to match schema.prisma (backfilled to now() for existing rows)
ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
