create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
drop policy if exists "user settings select own" on public.user_settings;
create policy "user settings select own" on public.user_settings for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "user settings insert own" on public.user_settings;
create policy "user settings insert own" on public.user_settings for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "user settings update own" on public.user_settings;
create policy "user settings update own" on public.user_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update on public.user_settings to authenticated;

create table if not exists public.answer_feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating text not null check (rating in ('up', 'down')),
  reason text,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

alter table public.answer_feedback enable row level security;
drop policy if exists "answer feedback select own" on public.answer_feedback;
create policy "answer feedback select own" on public.answer_feedback for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "answer feedback insert own" on public.answer_feedback;
create policy "answer feedback insert own" on public.answer_feedback for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "answer feedback update own" on public.answer_feedback;
create policy "answer feedback update own" on public.answer_feedback for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update on public.answer_feedback to authenticated;
