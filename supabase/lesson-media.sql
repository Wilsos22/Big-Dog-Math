-- Public lesson-story images. Uploads are teacher-only through the protected
-- /api/teacher/lesson-media route; the public bucket lets projector and lesson
-- pages render the saved image URL without expiring links.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-media',
  'lesson-media',
  true,
  4194304,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Browser clients never write directly to this bucket. The service-role API
-- route bypasses RLS, and the public flag permits read-only delivery.
drop policy if exists "lesson media upload" on storage.objects;
drop policy if exists "lesson media update" on storage.objects;
drop policy if exists "lesson media delete" on storage.objects;

commit;
