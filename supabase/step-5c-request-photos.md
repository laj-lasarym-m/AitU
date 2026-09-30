# Step 5C.2 — private request photos

Prepared only: **no SQL, bucket creation or live uploads were executed**.
Step 5B authentication and Step 5C.1 request APIs, demo datasets, routing and
already-applied SQL remain unchanged.

## Exact manual Supabase setup

1. In the existing project, review **`supabase/step-5c-request-photos.sql`**.
   Step 5A and Step 5C.1 must already be applied. Do not rerun either old file.
2. Review existing policies on `storage.objects`. Supabase permissive policies
   are combined with OR: a pre-existing unrestricted policy for all buckets must
   not grant access to `request-photos`. The new migration does not change policies
   belonging to other buckets. Do not make this bucket public.
3. Execute only the new migration once in SQL Editor as `postgres`. It creates
   the private bucket itself; do not create it separately first. Existing objects
   cause the transaction to fail instead of being silently overwritten. If this
   bucket/table already exists, inspect its setup before applying anything.
4. In Storage verify `request-photos` is **private**, with a 5 MB file limit and
   `image/jpeg`, `image/png`, `image/webp` allowed. The project's global upload
   limit must allow 5 MB too. No new frontend environment variables or secrets
   are required.
5. With existing test accounts, perform the browser and access checks below.

## Objects and permissions

- Private `storage.buckets` entry `request-photos`, max 5,242,880 bytes/file.
- `public.request_photos`: UUID, request/profile foreign keys, server-default
  owner and timestamp, unique storage path, `kind` default `citizen`; before/after
  values are reserved for a later step. Path constraints tie the first two folders
  to `user_id` and `request_id`, followed by a UUID filename and allowed extension.
- Request/date index, primary-key and unique-path indexes.
- `aitu_check_request_photo()` and `aitu_request_photo_check`: owner/citizen checks,
  parent-request lock, maximum five metadata records even for concurrent inserts,
  and verification that an uploaded object exists. The trigger has a fixed empty
  search path, qualified objects, and no browser EXECUTE grant.
- Metadata RLS: `request_photos_citizen_insert`, `request_photos_citizen_read`,
  `request_photos_authority_read`. Citizens can insert/read their own request's
  metadata; verified authority can read metadata for requests visible through
  existing request RLS. INSERT grants cover only `request_id, storage_path`.
  Browser callers cannot set another owner, kind, timestamp or ID. There are no
  metadata UPDATE/DELETE grants or policies.
- Storage INSERT: `request_photos_storage_insert` requires authenticated citizen,
  UID first folder and an existing owned request in the second folder.
- Storage SELECT: `request_photos_storage_owner_read` permits owner request files;
  `request_photos_storage_authority_read` permits verified authority to read linked
  photo records. Anonymous and other-citizen access are not granted.
- Storage DELETE: `request_photos_storage_orphan_delete` permits only an owner's
  unlinked upload under their own request. Linked evidence cannot be deleted by
  the browser. No Storage UPDATE/upsert or authority upload policy is added.

## Upload and display

The existing landing attachment button opens a multiple-image selector. MIME
type, size and total count are checked before submission; extensions alone are
not trusted. Selected files stay in React memory, show removable object-URL
previews and a count. Preview URLs are revoked on removal/unmount. Selection
does not upload anything. Guest text recovery is unchanged; guests are told to
reselect photos after login. No file bytes/base64 are put into browser storage.

The existing request API creates the real request first. Photos then upload
sequentially under `{authenticated_user_id}/{request_uuid}/{random_uuid}.ext`
without upsert. Only after upload is metadata inserted. Raw filenames and signed
URLs are never saved in metadata. The caller's current authenticated user must
match the created request owner; RLS remains the actual security boundary.

Both real detail panels load metadata for the selected request and request
five-minute signed URLs. They reuse these URLs in component memory across tab
changes and renew them after four minutes; account/request changes discard old
responses. No public URL is generated and no signed URL is persisted. A signed
URL grants temporary access until expiry, so it should not be shared or logged.

Citizen **Фото до / после** shows **Фото обращения**, labelled **Фото жителя**.
Authority overview thumbnails and **Фото** show the same records. Images open
in a responsive native-dialog viewer. Empty, loading and error states are explicit,
with a refresh action. No authority after-photo is invented. Authority evidence
upload and adding photos to an already submitted request are deferred.

Existing demo photo previews, local updates and demo status-modal photos remain
separate. Demo records cause no metadata reads, signed-URL calls or uploads.

## Partial failures

A failed photo does not roll back or resubmit the request. The completion dialog
shows its server number, uploaded/failed counts and **Открыть мои обращения**.
Closing or pressing Escape also opens the existing request list. The form cannot
be submitted again from that completion state. There is no automatic upload retry
or second request creation. Successful attachments remain visible.

If metadata insertion fails, the client first checks whether the response was
lost after a successful insert. A linked record is preserved. Otherwise it tries
to delete that unlinked object through the restricted Storage API. Offline or
timed-out operations can leave orphan files; cleanup is best effort. Trusted
maintenance should inspect unlinked objects and use the Storage API to remove
them, never delete `storage.objects` rows directly. A privileged deletion of a
request/profile also needs Storage cleanup; FK cascades remove metadata, not bytes.

## Verification and limits

Run `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`.
Tests cover MIME/size/count, safe paths, owner/demo guards, create-before-upload,
partial failures without duplicate requests, orphan cleanup/lost responses,
signed-URL mapping, actual component rendering, and static SQL restrictions.
Fixtures do not execute PostgreSQL/RLS or upload to production.

After manual setup:

1. Citizen A submits JPEG/PNG/WEBP photos with a new request; reload and open its
   photo tab. Verify count, full-size viewing, removal before submission and
   rejection of a sixth file, unsupported MIME or over-5-MB image.
2. Verified authority opens the same request and sees the same attachments.
   Reload and leave a detail open past five minutes to verify renewal.
3. Citizen B and anonymous callers must fail when reading metadata or signing/
   downloading A's guessed paths. Test upload into another UID folder and into
   another request under one's own UID; both must fail. Metadata owner/kind
   spoofing must fail. Use authenticated clients, not SQL Editor's postgres role.
4. Confirm pending/rejected applicants do not acquire authority photo access;
   workflow/status changes and text-only request creation still work.
5. Simulate an upload or metadata failure: one request remains, the completion
   message is accurate, linked photos remain, and no duplicate insert occurs.
6. Check guest text recovery/reselection, demo isolation, both themes, narrow
   screens, expired-image refresh and the enlarged viewer's Escape/close behavior.

Browser automation had no available browser surface during this run. Automated
component/fixture checks do not replace this post-migration live verification.

## File inventory

Started before interruption (six files):

- `supabase/step-5c-request-photos.sql`
- `src/requests/photos.js`, `src/requests/useRequestPhotos.js`
- `src/components/requests/PhotoPreviews.jsx`, `RequestPhotoGallery.jsx`
- `src/styles/request-photos.css`

Added during continuation:

- `tests/request-photos.test.js`
- `supabase/step-5c-request-photos.md`

Modified during continuation:

- `src/requests/photos.js` — bounded upload/metadata waits
- `src/components/requests/PhotoPreviews.jsx` — unfinished JSX closure fixed
- `src/components/requests/CreateRequestDialog.jsx` — upload orchestration and
  non-resubmitting partial-success completion
- `src/components/LandingForm.jsx` — existing button, selection/removal/previews
- `src/components/dashboard/RequestDetails.jsx` and
  `src/components/authority/AuthorityRequestDetails.jsx` — real galleries
- `src/App.jsx` — photo help text
- `tests/request-pages.test.js` — auth context and photo rendering checks
- `README.md` — setup link and current stage

No changes to applied SQL, auth, request API, dependencies or demo datasets.
No maps, AI, OCR, comments, notifications or Step 5C.3 work.

References: [private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals),
[bucket limits](https://supabase.com/docs/guides/storage/uploads/file-limits).
