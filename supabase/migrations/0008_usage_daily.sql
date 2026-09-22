create table public.usage_daily (
  user_id       uuid references auth.users not null,
  usage_date    date not null default current_date,
  message_count int not null default 0,
  primary key (user_id, usage_date)
);

alter table public.usage_daily enable row level security;

create policy "users can see their own usage"
  on public.usage_daily for select
  using (auth.uid() = user_id);

-- The Edge Function calls this with the service-role key. Keeping the increment in
-- Postgres makes the read/increment/write sequence atomic under concurrent requests.
create or replace function public.increment_usage_daily(target_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  insert into public.usage_daily (user_id, usage_date, message_count)
  values (target_user_id, current_date, 1)
  on conflict (user_id, usage_date)
  do update set message_count = public.usage_daily.message_count + 1
  returning message_count into next_count;

  return next_count;
end;
$$;

revoke all on function public.increment_usage_daily(uuid) from public;
grant execute on function public.increment_usage_daily(uuid) to service_role;
grant select on public.usage_daily to authenticated;