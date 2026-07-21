-- Inventory Movement Audit Trail
-- Adds enums, InventoryMovement, StockReservation, and DamagedStock models

-- New enums
CREATE TYPE "InventoryMovementType" AS ENUM (
  'OPENING_STOCK', 'STOCK_IN', 'STOCK_OUT',
  'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'DAMAGE',
  'RESERVE', 'UNRESERVE', 'PRODUCTION_IN', 'PRODUCTION_OUT'
);

CREATE TYPE "InventoryReferenceType" AS ENUM (
  'PURCHASE_ORDER', 'SALES_ORDER', 'GOODS_RECEIPT', 'STOCK_TRANSFER',
  'STOCK_ADJUSTMENT', 'PURCHASE_RETURN', 'SALES_RETURN',
  'PRODUCTION_ORDER', 'MANUAL', 'OPENING_STOCK'
);

CREATE TYPE "InventoryMovementSource" AS ENUM (
  'WEB', 'MOBILE', 'BARCODE', 'IMPORT', 'API', 'AI'
);

CREATE TYPE "InventoryItemStatus" AS ENUM (
  'AVAILABLE', 'RESERVED', 'DAMAGED', 'QUALITY_CHECK', 'IN_TRANSIT', 'BLOCKED'
);

-- Inventory Movement Audit Trail (immutable, append-only)
CREATE TABLE "inventory_movements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "branch_id" UUID,
  "movement_type" "InventoryMovementType" NOT NULL,
  "item_id" UUID NOT NULL,
  "warehouse_id" UUID,
  "source_warehouse_id" UUID,
  "destination_warehouse_id" UUID,
  "quantity_before" DECIMAL(18,3) NOT NULL,
  "quantity_after" DECIMAL(18,3) NOT NULL,
  "quantity_delta" DECIMAL(18,3) NOT NULL,
  "value_before_paise" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "value_after_paise" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "rate" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "reference_type" "InventoryReferenceType",
  "reference_id" UUID,
  "reference_number" TEXT,
  "user_id" UUID NOT NULL,
  "reason" TEXT,
  "notes" TEXT,
  "approved_by" UUID,
  "approved_at" TIMESTAMP(3),
  "status" "InventoryItemStatus" DEFAULT 'AVAILABLE',
  "source" "InventoryMovementSource" NOT NULL DEFAULT 'WEB',
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inventory_movements_tenant_company_item_created_idx"
  ON "inventory_movements"("tenant_id", "company_id", "item_id", "created_at" DESC);

CREATE INDEX "inventory_movements_tenant_company_warehouse_created_idx"
  ON "inventory_movements"("tenant_id", "company_id", "warehouse_id", "created_at" DESC);

CREATE INDEX "inventory_movements_tenant_ref_type_ref_id_idx"
  ON "inventory_movements"("tenant_id", "reference_type", "reference_id");

CREATE INDEX "inventory_movements_tenant_company_created_idx"
  ON "inventory_movements"("tenant_id", "company_id", "created_at" DESC);

-- Stock Reservations (enterprise reserved stock)
CREATE TABLE "stock_reservations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL,
  "reference_type" TEXT,
  "reference_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMP(3),
  "created_by" UUID,
  "updated_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_reservations_tenant_company_item_wh_status_idx"
  ON "stock_reservations"("tenant_id", "company_id", "item_id", "warehouse_id", "status");

-- Damaged Stock Log
CREATE TABLE "damaged_stock" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "batch_id" UUID,
  "quantity" DECIMAL(18,3) NOT NULL,
  "reason" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "disposal_status" TEXT NOT NULL DEFAULT 'PENDING',
  "created_by" UUID,
  "updated_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "damaged_stock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "damaged_stock_tenant_company_item_wh_idx"
  ON "damaged_stock"("tenant_id", "company_id", "item_id", "warehouse_id");