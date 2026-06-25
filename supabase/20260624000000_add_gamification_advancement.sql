-- Migration Script: Node Advancement via XP Thresholds

-- 1. Create system_flags table
CREATE TABLE IF NOT EXISTS system_flags (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed ALL 28 thresholds completely
INSERT INTO system_flags (key, value) VALUES (
    'node_xp_thresholds', 
    '{ "1-1": 100, "1-2": 200, "1-3": 350, "1-4": 500, "1-5": 700, "2-1": 950, "2-2": 1250, "2-3": 1600, "2-4": 2000, "2-5": 2450, "2-6": 2950, "3-1": 3500, "3-2": 4200, "3-3": 5000, "3-4": 5900, "3-5": 6900, "3-6": 8000, "4-1": 8800, "4-2": 9700, "4-3": 10700, "4-4": 11800, "4-5": 13000, "5-1": 14500, "5-2": 16000, "5-3": 17750, "5-4": 19750, "5-5": 22000, "5-6": 25000 }'
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. Create journey_region_nodes table
CREATE TABLE IF NOT EXISTS journey_region_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.journey_profiles(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    region_id TEXT NOT NULL,
    status region_status DEFAULT 'LOCKED'::region_status NOT NULL,
    unlocked_at TIMESTAMPTZ,
    shifted_at TIMESTAMPTZ,
    UNIQUE(user_id, node_id)
);

-- 3. Create indices for faster lookups
CREATE INDEX IF NOT EXISTS idx_journey_region_nodes_user_id ON journey_region_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_journey_region_nodes_status ON journey_region_nodes(status);
