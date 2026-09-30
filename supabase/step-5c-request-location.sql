-- Step 5C.3: REVIEW and apply manually ONCE after Step 5C.1/5C.2.
-- Never executed by the app. Do not rerun previous migrations.
begin;

alter table public.requests
  add column latitude double precision,
  add column longitude double precision,
  add constraint requests_latitude_range check (latitude between -90 and 90),
  add constraint requests_longitude_range check (longitude between -180 and 180),
  add constraint requests_location_pair check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null)
  );

-- Existing citizen INSERT RLS still requires the authenticated request owner.
grant insert (latitude, longitude) on public.requests to authenticated;
-- Existing table SELECT grant covers the new columns, subject to existing RLS.
-- No UPDATE grant: neither citizens nor authority can rewrite coordinates.
-- No policy changes, backfill, fabricated locations, or public access.

commit;
