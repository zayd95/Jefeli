-- Pilot cut (f) — Wecci « Donner »: a new listing mode. Added alone, because a new enum value can
-- only be used once the transaction that adds it has committed (next migration).
alter type public.listing_mode add value if not exists 'give';
