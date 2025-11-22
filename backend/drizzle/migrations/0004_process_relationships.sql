ALTER TABLE processes
ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES companies(id) ON DELETE CASCADE;

UPDATE processes p
SET business_id = bu.company_id
FROM business_units bu
WHERE p.business_unit_id = bu.id
  AND p.business_id IS NULL;

ALTER TABLE processes
ALTER COLUMN business_id SET NOT NULL;

ALTER TABLE pain_points
DROP COLUMN IF EXISTS process_id;

CREATE TABLE IF NOT EXISTS process_pain_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  pain_point_id uuid NOT NULL REFERENCES pain_points(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS process_use_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  use_case_id uuid NOT NULL REFERENCES use_cases(id) ON DELETE CASCADE
);
