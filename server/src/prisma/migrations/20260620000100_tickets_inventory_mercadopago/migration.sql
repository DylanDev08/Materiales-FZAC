DO $$ BEGIN
  CREATE TYPE "TicketStatus" AS ENUM ('ISSUED', 'PRINTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryMovementType" AS ENUM ('SALE', 'RETURN', 'ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "purchase_tickets" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerEmail" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "taxId" TEXT,
  "paymentProvider" TEXT NOT NULL,
  "paymentId" TEXT,
  "status" "TicketStatus" NOT NULL DEFAULT 'ISSUED',
  "subtotal" DECIMAL(12,2) NOT NULL,
  "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "shippingCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL,
  "shippingMethod" "ShippingMethod" NOT NULL,
  "addressSnapshot" JSONB,
  "notes" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "purchase_tickets_number_key" ON "purchase_tickets"("number");
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_tickets_orderId_key" ON "purchase_tickets"("orderId");
CREATE INDEX IF NOT EXISTS "purchase_tickets_status_issuedAt_idx" ON "purchase_tickets"("status", "issuedAt");
CREATE INDEX IF NOT EXISTS "purchase_tickets_customerEmail_idx" ON "purchase_tickets"("customerEmail");

DO $$ BEGIN
  ALTER TABLE "purchase_tickets" ADD CONSTRAINT "purchase_tickets_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "purchase_ticket_items" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "productId" TEXT,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "subtotal" DECIMAL(12,2) NOT NULL,
  "stockBefore" INTEGER,
  "stockAfter" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_ticket_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "purchase_ticket_items_ticketId_idx" ON "purchase_ticket_items"("ticketId");
CREATE INDEX IF NOT EXISTS "purchase_ticket_items_productId_idx" ON "purchase_ticket_items"("productId");

DO $$ BEGIN
  ALTER TABLE "purchase_ticket_items" ADD CONSTRAINT "purchase_ticket_items_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "purchase_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_ticket_items" ADD CONSTRAINT "purchase_ticket_items_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "inventory_movements" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "orderId" TEXT,
  "actorId" TEXT,
  "type" "InventoryMovementType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "stockBefore" INTEGER NOT NULL,
  "stockAfter" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "inventory_movements_productId_createdAt_idx" ON "inventory_movements"("productId", "createdAt");
CREATE INDEX IF NOT EXISTS "inventory_movements_orderId_idx" ON "inventory_movements"("orderId");
CREATE INDEX IF NOT EXISTS "inventory_movements_actorId_idx" ON "inventory_movements"("actorId");

DO $$ BEGIN
  ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "payments" ALTER COLUMN "provider" SET DEFAULT 'MERCADOPAGO';
