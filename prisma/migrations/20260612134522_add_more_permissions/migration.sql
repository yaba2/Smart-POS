-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Permission" ADD VALUE 'MODIFY_SENT_ORDERS';
ALTER TYPE "Permission" ADD VALUE 'PROCESS_REFUND';
ALTER TYPE "Permission" ADD VALUE 'VIEW_ALL_ORDERS';
ALTER TYPE "Permission" ADD VALUE 'OVERRIDE_PRICES';
ALTER TYPE "Permission" ADD VALUE 'APPLY_DISCOUNT';
ALTER TYPE "Permission" ADD VALUE 'SPLIT_BILL';
ALTER TYPE "Permission" ADD VALUE 'VIEW_SHIFT_REPORTS';
ALTER TYPE "Permission" ADD VALUE 'EXPORT_REPORTS';
ALTER TYPE "Permission" ADD VALUE 'OPEN_SHIFT';
ALTER TYPE "Permission" ADD VALUE 'VIEW_SHIFT_HISTORY';
ALTER TYPE "Permission" ADD VALUE 'MANAGE_ROLES';
ALTER TYPE "Permission" ADD VALUE 'MANAGE_CATEGORIES';
ALTER TYPE "Permission" ADD VALUE 'MANAGE_MODIFIERS';
ALTER TYPE "Permission" ADD VALUE 'UPDATE_INVENTORY';
ALTER TYPE "Permission" ADD VALUE 'RESERVE_TABLES';
ALTER TYPE "Permission" ADD VALUE 'MANAGE_TAX_RATES';
ALTER TYPE "Permission" ADD VALUE 'CONFIGURE_PRINTERS';
ALTER TYPE "Permission" ADD VALUE 'VIEW_AUDIT_LOG';
ALTER TYPE "Permission" ADD VALUE 'BACKUP_DATA';
