-- Public logos bucket for team + league images (Supabase Storage free tier).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public logos read" on storage.objects;
create policy "Public logos read"
on storage.objects for select
using (bucket_id = 'logos');

drop policy if exists "Users upload own logos" on storage.objects;
create policy "Users upload own logos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users update own logos" on storage.objects;
create policy "Users update own logos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users delete own logos" on storage.objects;
create policy "Users delete own logos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
