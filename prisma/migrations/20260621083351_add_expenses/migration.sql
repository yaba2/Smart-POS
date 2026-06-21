-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FOOD', 'DRINKS', 'SUPPLIES', 'SALARIES', 'RENT', 'UTILITIES', 'MAINTENANCE', 'MARKETING', 'TRANSPORT', 'OTHER');

-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'MANAGE_EXPENSES';

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
