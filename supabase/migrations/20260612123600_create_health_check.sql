create table if not exists public.health_check (
  id smallint primary key default 1 check (id = 1),
  label text not null default 'supabase-keepalive',
  created_at timestamptz not null default now()
);

insert into public.health_check (id, label)
values (1, 'supabase-keepalive')
on conflict (id) do nothing;

alter table public.health_check enable row level security;

drop policy if exists "Allow public keepalive read" on public.health_check;

create policy "Allow public keepalive read"
on public.health_check
for select
to anon
using (true);

grant select on public.health_check to anon;
