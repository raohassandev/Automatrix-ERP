-- AlterTable
ALTER TABLE "GoodsReceipt" ADD COLUMN     "projectRef" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "projectRef" TEXT;

-- AlterTable
ALTER TABLE "VendorBill" ADD COLUMN     "projectRef" TEXT;

-- AlterTable
ALTER TABLE "VendorPayment" ADD COLUMN     "projectRef" TEXT;
