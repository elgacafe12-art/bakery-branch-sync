
-- Add 'usage' movement type for branch raw material usage
ALTER TYPE public.movement_type ADD VALUE IF NOT EXISTS 'usage';
