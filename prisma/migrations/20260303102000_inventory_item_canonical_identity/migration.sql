ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "canonicalName" TEXT;

UPDATE "InventoryItem"
SET "canonicalName" = regexp_replace(lower(trim(coalesce("name", ''))), '[^a-z0-9]+', '', 'g')
WHERE "canonicalName" IS NULL OR "canonicalName" = '';

DO $$
DECLARE
  conflict_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO conflict_count
  FROM (
    SELECT "canonicalName"
    FROM "InventoryItem"
    GROUP BY "canonicalName"
    HAVING COUNT(*) > 1
  ) t;

  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'Inventory canonical-name collisions found (%). Resolve duplicates before migration.', conflict_count;
  END IF;
END $$;

ALTER TABLE "InventoryItem" ALTER COLUMN "canonicalName" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryItem_canonicalName_key"
ON "InventoryItem"("canonicalName");

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryItem_sku_non_empty_key"
ON "InventoryItem"("sku")
WHERE "sku" IS NOT NULL AND btrim("sku") <> '';
