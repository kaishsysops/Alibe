-- Typo-tolerant search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Category tree: order, synonyms, per-category questions, hide switch.
ALTER TABLE "Category" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "attributes" JSONB,
  ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Category_parentId_sortOrder_idx" ON "Category"("parentId", "sortOrder");

-- Listing answers to those questions.
ALTER TABLE "Listing" ADD COLUMN "attributes" JSONB NOT NULL DEFAULT '{}';
CREATE INDEX "Listing_attributes_idx" ON "Listing" USING GIN ("attributes");
CREATE INDEX "Listing_title_trgm_idx" ON "Listing" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "IbayItem_title_trgm_idx" ON "IbayItem" USING GIN ("title" gin_trgm_ops);
