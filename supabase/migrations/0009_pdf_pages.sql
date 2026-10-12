create table if not exists public.document_pages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  page_number int not null check (page_number >= 1),
  image_path text not null,
  image_width int not null,
  image_height int not null,
  words jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, page_number)
);

alter table public.document_pages enable row level security;

drop policy if exists "document pages select in own document" on public.document_pages;
create policy "document pages select in own document"
  on public.document_pages for select to authenticated
  using (public.user_owns_document(document_id));

grant select on public.document_pages to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notes-pages', 'notes-pages', false, 5242880, array['image/jpeg'])
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg'];

drop policy if exists "page images select from own folder" on storage.objects;
create policy "page images select from own folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'notes-pages'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "page images delete from own folder" on storage.objects;
create policy "page images delete from own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'notes-pages'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

update storage.buckets
set allowed_mime_types = array['application/pdf', 'text/plain', 'text/markdown', 'text/x-markdown']
where id = 'notes-documents';
