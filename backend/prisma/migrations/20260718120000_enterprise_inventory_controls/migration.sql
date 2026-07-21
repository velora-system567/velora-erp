-- Enterprise inventory controls: product traceability, warehouse hierarchy,
-- location master, reservations, serial identity, and cycle counting.
ALTER TABLE "items"
  ADD COLUMN "barcode" TEXT,
  ADD COLUMN "qr_code" TEXT,
  ADD COLUMN "brand" TEXT,
  ADD COLUMN "image_url" TEXT,
  ADD COLUMN "attributes" JSONB,
  ADD COLUMN "attachments" JSONB,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "tracking_mode" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN "lifecycle_status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "safety_stock" DECIMAL(18,3),
  ADD COLUMN "eoq_quantity" DECIMAL(18,3),
  ADD COLUMN "lead_time_days" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "warehouses"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "parent_warehouse_id" UUID,
  ADD COLUMN "warehouse_type" TEXT NOT NULL DEFAULT 'WAREHOUSE',
  ADD COLUMN "capacity" DECIMAL(18,3),
  ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "inventory_locations" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "parent_id" UUID,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "zone" TEXT,
  "bin" TEXT,
  "capacity" DECIMAL(18,3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" UUID,
  "updated_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "inventory_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_reservations" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "branch_id" UUID,
  "item_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "location_id" UUID,
  "quantity" DECIMAL(18,3) NOT NULL,
  "reference_id" UUID,
  "reference_type" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMP(3),
  "created_by" UUID,
  "updated_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_serials" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "warehouse_id" UUID,
  "batch_id" UUID,
  "serial_number" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "received_at" TIMESTAMP(3),
  "sold_at" TIMESTAMP(3),
  "created_by" UUID,
  "updated_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "product_serials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cycle_counts" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "branch_id" UUID,
  "warehouse_id" UUID NOT NULL,
  "count_number" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "scheduled_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "notes" TEXT,
  "created_by" UUID,
  "updated_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "cycle_counts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cycle_count_lines" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "cycle_count_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "expected_qty" DECIMAL(18,3) NOT NULL,
  "counted_qty" DECIMAL(18,3),
  "variance_qty" DECIMAL(18,3),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "cycle_count_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "items_tenant_id_barcode_idx" ON "items"("tenant_id", "barcode");
CREATE INDEX "items_tenant_id_qr_code_idx" ON "items"("tenant_id", "qr_code");
CREATE UNIQUE INDEX "warehouses_tenant_id_company_id_code_key" ON "warehouses"("tenant_id", "company_id", "code");
CREATE UNIQUE INDEX "inventory_locations_tenant_id_warehouse_id_code_key" ON "inventory_locations"("tenant_id", "warehouse_id", "code");
CREATE INDEX "inventory_locations_tenant_id_company_id_warehouse_id_is_deleted_idx" ON "inventory_locations"("tenant_id", "company_id", "warehouse_id", "is_deleted");
CREATE INDEX "inventory_reservations_tenant_id_company_id_item_id_warehouse_id_status_idx" ON "inventory_reservations"("tenant_id", "company_id", "item_id", "warehouse_id", "status");
CREATE UNIQUE INDEX "product_serials_tenant_id_serial_number_key" ON "product_serials"("tenant_id", "serial_number");
CREATE INDEX "product_serials_tenant_id_company_id_item_id_status_idx" ON "product_serials"("tenant_id", "company_id", "item_id", "status");
CREATE UNIQUE INDEX "cycle_counts_tenant_id_count_number_key" ON "cycle_counts"("tenant_id", "count_number");
CREATE INDEX "cycle_counts_tenant_id_company_id_warehouse_id_status_idx" ON "cycle_counts"("tenant_id", "company_id", "warehouse_id", "status");
CREATE UNIQUE INDEX "cycle_count_lines_cycle_count_id_item_id_key" ON "cycle_count_lines"("cycle_count_id", "item_id");
CREATE INDEX "cycle_count_lines_tenant_id_company_id_cycle_count_id_idx" ON "cycle_count_lines"("tenant_id", "company_id", "cycle_count_id");
