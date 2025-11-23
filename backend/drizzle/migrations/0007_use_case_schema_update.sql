-- Migration: Update use_cases schema
-- Rename description to solution_provider
ALTER TABLE "use_cases" RENAME COLUMN "description" TO "solution_provider";

-- Change expected_benefits from text to numeric
ALTER TABLE "use_cases" ALTER COLUMN "expected_benefits" TYPE numeric USING NULLIF("expected_benefits", '')::numeric;

-- Change data_requirements to text array
ALTER TABLE "use_cases" ALTER COLUMN "data_requirements" TYPE text[] USING CASE 
  WHEN "data_requirements" IS NULL OR "data_requirements" = '' THEN ARRAY[]::text[]
  ELSE string_to_array("data_requirements", ',')
END;

-- Make process_id nullable (it already is, but ensuring constraint)
ALTER TABLE "use_cases" ALTER COLUMN "process_id" DROP NOT NULL;

-- Drop removed columns
ALTER TABLE "use_cases" DROP COLUMN IF EXISTS "value_drivers";
ALTER TABLE "use_cases" DROP COLUMN IF EXISTS "estimated_fte_hours";
ALTER TABLE "use_cases" DROP COLUMN IF EXISTS "roi_estimate";
