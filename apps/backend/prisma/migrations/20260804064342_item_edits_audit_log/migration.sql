-- CreateTable
CREATE TABLE "item_edits" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "actorId" TEXT,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_edits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_edits_itemId_idx" ON "item_edits"("itemId");

-- AddForeignKey
ALTER TABLE "item_edits" ADD CONSTRAINT "item_edits_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_edits" ADD CONSTRAINT "item_edits_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
