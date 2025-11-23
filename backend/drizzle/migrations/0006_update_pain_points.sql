-- Rename opportunity_potential to effort_solving
ALTER TABLE pain_points RENAME COLUMN opportunity_potential TO effort_solving;

-- Change impact_type from text to text array
ALTER TABLE pain_points ALTER COLUMN impact_type TYPE text[] USING CASE 
  WHEN impact_type IS NULL THEN NULL 
  ELSE ARRAY[impact_type] 
END;

-- Add new columns
ALTER TABLE pain_points ADD COLUMN time_per_unit numeric;
ALTER TABLE pain_points ADD COLUMN total_hours_per_month numeric;
ALTER TABLE pain_points ADD COLUMN fte_count numeric;
