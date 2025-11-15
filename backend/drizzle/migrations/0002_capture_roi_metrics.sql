ALTER TABLE "use_cases" ADD COLUMN "hours_saved_per_occurrence" numeric NOT NULL DEFAULT 0;
ALTER TABLE "use_cases" ADD COLUMN "occurrences_per_month" numeric NOT NULL DEFAULT 0;
ALTER TABLE "use_cases" ADD COLUMN "value_per_hour" numeric NOT NULL DEFAULT 0;
ALTER TABLE "use_cases" ADD COLUMN "value_score" numeric NOT NULL DEFAULT 0;

UPDATE "use_cases"
SET "value_score" = "hours_saved_per_occurrence" * "occurrences_per_month" * "value_per_hour";
