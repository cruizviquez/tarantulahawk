-- Add sector_actividad and fraccion_lfpiorpi to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS sector_actividad TEXT;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS fraccion_lfpiorpi TEXT;

-- Optional: set existing nulls to 'servicios_generales'
UPDATE profiles SET fraccion_lfpiorpi = 'servicios_generales' WHERE fraccion_lfpiorpi IS NULL;

-- Ensure we have safe defaults before applying NOT NULL constraints
ALTER TABLE profiles ALTER COLUMN fraccion_lfpiorpi SET DEFAULT 'servicios_generales';
ALTER TABLE profiles ALTER COLUMN sector_actividad SET DEFAULT 'Sin especificar';

-- Make columns non-nullable now that defaults/values are set
UPDATE profiles SET fraccion_lfpiorpi = 'servicios_generales' WHERE fraccion_lfpiorpi IS NULL OR fraccion_lfpiorpi = '';
UPDATE profiles SET sector_actividad = 'Sin especificar' WHERE sector_actividad IS NULL OR sector_actividad = '';

ALTER TABLE profiles ALTER COLUMN fraccion_lfpiorpi SET NOT NULL;
ALTER TABLE profiles ALTER COLUMN sector_actividad SET NOT NULL;
