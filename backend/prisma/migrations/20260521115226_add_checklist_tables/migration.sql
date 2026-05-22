-- CreateTable
CREATE TABLE "checklist_items" (
    "id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "order" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 1,
    "category" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_checklist_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "checklist_item_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "is_done" BOOLEAN NOT NULL DEFAULT false,
    "done_at" TIMESTAMP(3),

    CONSTRAINT "daily_checklist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_checklist_entries_user_id_checklist_item_id_date_key" ON "daily_checklist_entries"("user_id", "checklist_item_id", "date");

-- AddForeignKey
ALTER TABLE "daily_checklist_entries" ADD CONSTRAINT "daily_checklist_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_checklist_entries" ADD CONSTRAINT "daily_checklist_entries_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
