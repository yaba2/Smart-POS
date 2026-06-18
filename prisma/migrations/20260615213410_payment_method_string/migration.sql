-- Convert enum columns to TEXT, preserving existing values
ALTER TABLE "Order" ALTER COLUMN "paymentMethod" TYPE TEXT USING "paymentMethod"::TEXT;

ALTER TABLE "Payment" ALTER COLUMN "method" TYPE TEXT USING "method"::TEXT;

-- DropEnum
DROP TYPE "PaymentMethod";
