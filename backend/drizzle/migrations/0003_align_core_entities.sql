DROP TABLE IF EXISTS use_cases;

CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  industry text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  fte numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit_id uuid NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  volume numeric,
  volume_unit text,
  fte numeric,
  owner text,
  systems_used text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pain_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  statement text NOT NULL,
  impact_type text,
  business_impact text,
  magnitude numeric,
  frequency numeric,
  root_cause text,
  workarounds text,
  dependencies text,
  risk_level text,
  opportunity_potential numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS use_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  summary text,
  value_score numeric NOT NULL DEFAULT 0,
  effort_score numeric NOT NULL DEFAULT 0,
  risk_score numeric NOT NULL DEFAULT 0,
  complexity_score numeric NOT NULL DEFAULT 0,
  category text,
  maturity text,
  prerequisites text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pain_point_use_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pain_point_id uuid NOT NULL REFERENCES pain_points(id) ON DELETE CASCADE,
  use_case_id uuid NOT NULL REFERENCES use_cases(id) ON DELETE CASCADE
);
