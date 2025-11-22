CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  business_unit_id uuid NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  pain_point_ids uuid[],
  category text,
  estimated_value numeric,
  estimated_effort numeric,
  roi numeric,
  confidence numeric,
  tags text[],
  status text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS opportunity_pain_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  pain_point_id uuid NOT NULL REFERENCES pain_points(id) ON DELETE CASCADE
);
