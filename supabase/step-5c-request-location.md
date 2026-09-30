# Step 5C.3 — request location

Prepared only. **No SQL was executed and no existing rows were modified.**

## Manual Supabase step

Review `supabase/step-5c-request-location.sql`, then execute that file **once** in
the existing project's SQL Editor as postgres. Steps 5B, 5C.1 and 5C.2 must already
be applied. Do not rerun or edit their migrations. The new frontend selects the
new columns, so apply this migration before using/deploying the location-enabled
frontend against the live database. No bucket, secret, API key, extension or
Supabase Auth configuration change is needed.

The transaction adds nullable double-precision latitude and longitude, range
checks and a paired-value check (both null or both present). It adds only an
INSERT column grant for authenticated users. Existing citizen insert ownership
RLS, SELECT visibility and authority workflow-only UPDATE grants remain intact.
No coordinate UPDATE permission or policy is added. Existing table-level SELECT
covers the new columns under the same RLS. Existing A-101/A-102 rows stay null;
there is no backfill or address-to-coordinate conversion.

## Behavior

- The existing request review dialog includes a click-to-select map centered on
  Semey. The selected marker and coordinate output update locally; users can
  remove the point or submit without one. No location permission is requested.
- Address entry stays independent and is never replaced. No reverse geocoder,
  directions API, AI or paid service is used.
- Coordinates join the existing request INSERT payload. The unchanged photo
  helpers then upload and link photos using that request ID. Map interactions
  neither submit forms nor create requests; existing double-submit protection
  and partial-photo-success handling remain in effect.
- Real citizen and authority details show a small map and the existing address.
  A legacy or invalid/missing pair shows **Местоположение не указано.** Demo details
  keep their original illustrative MiniMap; demo coordinates never enter real maps.
- Citizen **Карта города** consumes only the already fetched, owner-filtered rows.
  It is initially a map of the citizen's own authorized requests, not a public
  city-wide dataset. RLS is not relaxed for map coverage.
- Verified authority **Карта обращений** uses its existing authorized fetch, with
  status/category filters. Both maps show number, title, status, category and
  address in popups; authority also sees priority. **Открыть обращение** returns
  to the existing detail flow with that real request selected and filters reset.
- Loading, fetch failures, no located records and tile failures have explicit
  messages. Tile failure leaves the request data and dialog available. A failed
  map module is contained by an error boundary. Maps are responsive and resize
  when the dialog/container changes.

## Libraries and tiles

Leaflet and React Leaflet are installed. The shared Leaflet module/CSS loads
lazily; browser-only imports are kept out of server rendering. Default marker
and shadow assets are bundled locally through Vite, including the retina icon.

Tiles use `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with visible linked
OpenStreetMap attribution. No offline download, tile prefetch or cache-bypass
is implemented. Normal browser referrers/cache behavior is retained. Tile
requests reveal the viewed area to the tile provider; request titles, user IDs,
photos and popup contents are not sent as tile parameters.

References: [React Leaflet setup](https://react-leaflet.js.org/docs/start-setup/),
[map events](https://react-leaflet.js.org/docs/api-map/),
[OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/).

## Validation

`npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`.
Tests cover numeric ranges (including zero), incomplete/null pairs, existing
request payloads, legacy rows, demo exclusion, citizen/authority fetched-data
mapping, rendering states, photo submission with coordinates and repeated map
selection without duplicate requests. SQL checks are static; mocked data tests
do not execute RLS on the live project.

After manual migration, test with existing accounts:

1. Citizen creates a request with address, point and photo. Verify the address,
   saved coordinates, same request ID, photo and detail map after reload.
2. Create without a point; confirm legacy A-101/A-102 still show their original
   data/photos and no invented marker.
3. Citizen city map shows only authorized owned rows; marker opens the matching
   detail. Another citizen must not see these requests.
4. Verified authority map shows the same point/photo, filters work, and marker
   navigation preserves the normal status-update flow.
5. Test narrow screens, both themes, blocked tile requests, and keyboard tab/zoom
   controls. Location remains optional when the tile service is unavailable.
6. Using authenticated API clients, reject out-of-range/incomplete pairs and
   coordinate UPDATE attempts by either citizen or authority. Use real client
   roles for these checks; SQL Editor as postgres bypasses RLS.

## Files

Created: `supabase/step-5c-request-location.sql`, this guide,
`src/requests/location.js`, `src/components/map/RequestMap.jsx`, `LeafletMap.jsx`,
`CityRequestMap.jsx`, `src/styles/request-map.css`, `tests/request-location.test.js`.

Modified: `package.json`, `package-lock.json`, `src/requests/api.js`,
`src/requests/model.js`, `src/components/requests/CreateRequestDialog.jsx`,
`src/components/dashboard/RequestDetails.jsx`,
`src/components/authority/AuthorityRequestDetails.jsx`,
`src/pages/DashboardPage.jsx`, `src/pages/AuthorityPage.jsx`,
`tests/request-pages.test.js`, `tests/landing-submission.test.js`, `README.md`.

Existing auth, photo implementation, demo datasets and applied SQL are untouched.
Step 5C.4 was not started.
