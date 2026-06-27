-- Add missing table for Level-Up feature unlocks
CREATE TABLE IF NOT EXISTS public.journey_unlock_events (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.journey_profiles(id) ON DELETE CASCADE,
    level_reached integer NOT NULL,
    feature_key text NOT NULL,
    shown boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    CONSTRAINT journey_unlock_events_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_journey_unlock_events_user_id ON public.journey_unlock_events(user_id) WHERE shown = false;
