-- Add REJECTED as a valid event status for business rule violations
-- that are intentionally rejected, not system failures.
ALTER TYPE journey_event_status ADD VALUE IF NOT EXISTS 'REJECTED';
