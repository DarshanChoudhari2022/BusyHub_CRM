-- ============================================================================
-- BuzyHub CRM — Fix missing 'project' column and reload schema cache
-- Run this in the Supabase SQL Editor to resolve the "Could not find project column" error.
-- ============================================================================

-- 1. Ensure the 'project' and other newer columns exist on the employees table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS project TEXT DEFAULT 'society_one';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS home_lat DOUBLE PRECISION;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS home_lng DOUBLE PRECISION;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS home_radius_m INTEGER DEFAULT 150;

-- 2. Notify PostgREST to reload the schema cache immediately
NOTIFY pgrst, 'reload schema';
