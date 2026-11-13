CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'STAFF');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PAYMENT_FAILED', 'CANCELLED', 'PREPARING', 'READY', 'COMPLETED');
CREATE TYPE "PaymentMethod" AS ENUM ('WALLET', 'CARD');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
CREATE TYPE "IdempotencyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "categories" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

CREATE TABLE "products" (
  "id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "base_price" INTEGER NOT NULL,
  "stock_quantity" INTEGER NOT NULL DEFAULT 0,
  "is_available" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "products_base_price_check" CHECK ("base_price" >= 0),
  CONSTRAINT "products_stock_quantity_check" CHECK ("stock_quantity" >= 0),
  CONSTRAINT "products_name_check" CHECK (length(trim("name")) > 0)
);

CREATE TABLE "sizes" (
  "id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "extra_price" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "sizes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sizes_extra_price_check" CHECK ("extra_price" >= 0)
);
CREATE UNIQUE INDEX "sizes_product_id_name_key" ON "sizes"("product_id", "name");

CREATE TABLE "toppings" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "extra_price" INTEGER NOT NULL,
  "is_available" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "toppings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "toppings_extra_price_check" CHECK ("extra_price" >= 0),
  CONSTRAINT "toppings_name_check" CHECK (length(trim("name")) > 0)
);
CREATE UNIQUE INDEX "toppings_name_key" ON "toppings"("name");

CREATE TABLE "product_toppings" (
  "product_id" UUID NOT NULL,
  "topping_id" UUID NOT NULL,
  CONSTRAINT "product_toppings_pkey" PRIMARY KEY ("product_id", "topping_id")
);

CREATE TABLE "orders" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "subtotal" INTEGER NOT NULL,
  "discount_amount" INTEGER NOT NULL DEFAULT 0,
  "total_amount" INTEGER NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_subtotal_check" CHECK ("subtotal" >= 0),
  CONSTRAINT "orders_discount_amount_check" CHECK ("discount_amount" >= 0),
  CONSTRAINT "orders_total_amount_check" CHECK ("total_amount" >= 0)
);
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");

CREATE TABLE "order_items" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "size_id" UUID NOT NULL,
  "product_name" TEXT NOT NULL,
  "size_name" TEXT NOT NULL,
  "unit_price" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "line_total" INTEGER NOT NULL,
  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_items_prices_check" CHECK ("unit_price" >= 0 AND "line_total" >= 0),
  CONSTRAINT "order_items_quantity_check" CHECK ("quantity" >= 1)
);

CREATE TABLE "order_item_toppings" (
  "id" UUID NOT NULL,
  "order_item_id" UUID NOT NULL,
  "topping_id" UUID NOT NULL,
  "topping_name" TEXT NOT NULL,
  "extra_price" INTEGER NOT NULL,
  CONSTRAINT "order_item_toppings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_item_toppings_extra_price_check" CHECK ("extra_price" >= 0)
);

CREATE TABLE "payments" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amount" INTEGER NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "gateway_transaction_id" TEXT,
  "failure_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_amount_check" CHECK ("amount" >= 0)
);
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");
CREATE INDEX "payments_order_id_created_at_idx" ON "payments"("order_id", "created_at");
CREATE UNIQUE INDEX "payments_one_success_per_order"
  ON "payments"("order_id") WHERE "status" = 'SUCCESS';
CREATE UNIQUE INDEX "payments_one_active_per_order"
  ON "payments"("order_id") WHERE "status" IN ('PENDING', 'SUCCESS');

CREATE TABLE "idempotency_keys" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "status" "IdempotencyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "response_status" INTEGER,
  "response_body" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "idempotency_keys_user_id_key_key" ON "idempotency_keys"("user_id", "key");
CREATE INDEX "idempotency_keys_status_created_at_idx" ON "idempotency_keys"("status", "created_at");

CREATE TABLE "mock_gateway_transactions" (
  "id" UUID NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "status" "PaymentStatus" NOT NULL,
  "scenario" TEXT NOT NULL,
  "gateway_transaction_id" TEXT NOT NULL,
  "failure_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mock_gateway_transactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "mock_gateway_transactions_idempotency_key_key" ON "mock_gateway_transactions"("idempotency_key");
CREATE UNIQUE INDEX "mock_gateway_transactions_gateway_transaction_id_key" ON "mock_gateway_transactions"("gateway_transaction_id");

ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sizes" ADD CONSTRAINT "sizes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_toppings" ADD CONSTRAINT "product_toppings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_toppings" ADD CONSTRAINT "product_toppings_topping_id_fkey" FOREIGN KEY ("topping_id") REFERENCES "toppings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_item_toppings" ADD CONSTRAINT "order_item_toppings_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_item_toppings" ADD CONSTRAINT "order_item_toppings_topping_id_fkey" FOREIGN KEY ("topping_id") REFERENCES "toppings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
