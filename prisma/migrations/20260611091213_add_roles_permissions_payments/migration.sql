-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'SAHAL', 'EVC', 'CARD');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('CANCEL_ORDER', 'SETTLE_BILL', 'VIEW_REPORTS', 'MANAGE_USERS', 'MANAGE_MENU', 'MANAGE_TABLES', 'MANAGE_SETTINGS', 'CLOSE_SHIFT');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'CASHIER';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" "PaymentMethod";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "permissions" "Permission"[];

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closingCash" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
